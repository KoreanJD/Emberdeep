import type { DiceRoller } from './types';

export const randomDice: DiceRoller = {
  d20: () => rollDie(20),
  die: (sides: number) => rollDie(sides),
};

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}
