import type { Entity, GameState, Position } from './types';

const directions: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function getReachablePositions(state: GameState, entityId: string): Position[] {
  const entity = state.entities[entityId];
  if (!entity || entity.hp <= 0 || entity.ap <= 0 || entity.statuses.some((status) => status.id === 'rooted')) {
    return [];
  }

  const visited = new Set<string>([positionKey(entity.position)]);
  const queue: Array<{ position: Position; distance: number }> = [
    { position: entity.position, distance: 0 },
  ];
  const reachable: Position[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of directions) {
      const next = {
        x: current.position.x + direction.x,
        y: current.position.y + direction.y,
      };
      const distance = current.distance + 1;
      const key = positionKey(next);

      if (visited.has(key) || distance > entity.move) {
        continue;
      }

      visited.add(key);

      if (!isWalkable(state, next, entity.id)) {
        continue;
      }

      reachable.push(next);
      queue.push({ position: next, distance });
    }
  }

  return reachable;
}

export function findStepToward(state: GameState, entityId: string, target: Position): Position | null {
  const entity = state.entities[entityId];
  if (!entity || entity.hp <= 0 || entity.statuses.some((status) => status.id === 'rooted')) {
    return null;
  }

  const reachable = getReachablePositionsForDistance(state, entity, entity.move);
  let best: Position | null = null;
  let bestDistance = manhattan(entity.position, target);

  for (const position of reachable) {
    const distance = manhattan(position, target);
    if (distance < bestDistance) {
      best = position;
      bestDistance = distance;
    }
  }

  return best;
}

export function getReachablePositionsForDistance(
  state: GameState,
  entity: Entity,
  maxDistance: number,
): Position[] {
  const visited = new Set<string>([positionKey(entity.position)]);
  const queue: Array<{ position: Position; distance: number }> = [
    { position: entity.position, distance: 0 },
  ];
  const reachable: Position[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const direction of directions) {
      const next = {
        x: current.position.x + direction.x,
        y: current.position.y + direction.y,
      };
      const distance = current.distance + 1;
      const key = positionKey(next);

      if (visited.has(key) || distance > maxDistance) {
        continue;
      }

      visited.add(key);

      if (!isWalkable(state, next, entity.id)) {
        continue;
      }

      reachable.push(next);
      queue.push({ position: next, distance });
    }
  }

  return reachable;
}

export function isAdjacent(a: Position, b: Position): boolean {
  return manhattan(a, b) === 1;
}

export function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function isWalkable(state: GameState, position: Position, movingEntityId?: string): boolean {
  if (position.x < 0 || position.y < 0 || position.x >= state.width || position.y >= state.height) {
    return false;
  }

  if (state.tiles[position.y]?.[position.x] === '#') {
    return false;
  }

  return !Object.values(state.entities).some(
    (entity) =>
      entity.id !== movingEntityId &&
      entity.hp > 0 &&
      entity.position.x === position.x &&
      entity.position.y === position.y,
  );
}
