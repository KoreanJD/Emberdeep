import { getDungeonRoomCount } from '../content/encounters';
import type { GameState, RewardOption } from './types';

export const rewardOptions: RewardOption[] = [
  {
    id: 'field_dressing',
    name: 'Field Dressing',
    description: 'Restore 3 HP before entering the next room.',
  },
  {
    id: 'ember_edge',
    name: 'Ember Edge',
    description: 'Add +1 damage to basic attacks for this run.',
  },
  {
    id: 'tactical_focus',
    name: 'Tactical Focus',
    description: 'Start the next room Blessed.',
  },
];

export function resolveRoomClear(state: GameState): GameState {
  if (state.currentRoomIndex >= getDungeonRoomCount() - 1) {
    return appendLog({ ...state, phase: 'victory', rewardOptions: [] }, {
      type: 'system',
      message: 'Victory! The goblins collapse and the dungeon path is secure.',
    });
  }

  return appendLog(
    {
      ...state,
      phase: 'reward',
      rewardOptions,
    },
    {
      type: 'system',
      message: 'Room cleared. Choose one reward before pressing deeper.',
    },
  );
}

function appendLog(
  state: GameState,
  entry: Omit<GameState['log'][number], 'id'>,
): GameState {
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: state.log.length + 1,
        ...entry,
      },
    ],
  };
}
