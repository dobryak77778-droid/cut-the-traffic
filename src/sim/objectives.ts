import type { FailReason, LevelObjective, ObjectiveType } from '../types';

/**
 * Objective helpers shared by the sim (win/fail rules), the HUD (labels) and
 * analytics. Pure data in, pure data out – no Phaser.
 */

/** Short all-caps headline shown when a level starts. */
export function objectiveTitle(obj: LevelObjective): string {
  switch (obj.type) {
    case 'CLEAR_TRAFFIC':
      return 'CLEAR ALL TRAFFIC';
    case 'SURVIVE':
      return `SURVIVE ${Math.round(obj.seconds)} SECONDS`;
    case 'PRESSURE_LIMIT':
      return `KEEP PRESSURE BELOW ${Math.round(obj.maxPressure * 100)}%`;
    case 'EMERGENCY':
      return 'GET THE AMBULANCE THROUGH';
    case 'QUEUE_LIMIT':
      return `MAX ${obj.maxQueue} CARS PER QUEUE`;
  }
}

/** One-line explanation shown under the headline. */
export function objectiveSubtitle(obj: LevelObjective): string {
  switch (obj.type) {
    case 'CLEAR_TRAFFIC':
      return 'Get every vehicle across safely';
    case 'SURVIVE':
      return "Don't let the traffic pressure max out";
    case 'PRESSURE_LIMIT':
      return 'Keep queues moving until the traffic is clear';
    case 'EMERGENCY':
      return `Across the junction within ${Math.round(obj.timeLimit)}s of arriving`;
    case 'QUEUE_LIMIT':
      return 'No lane may stack up more waiting cars than that';
  }
}

/** Compact label for level cards. */
export function objectiveCardLabel(obj: LevelObjective): string {
  switch (obj.type) {
    case 'CLEAR_TRAFFIC':
      return `${obj.totalVehicles} VEHICLES`;
    case 'SURVIVE':
      return `SURVIVE ${Math.round(obj.seconds)}s`;
    case 'PRESSURE_LIMIT':
      return `PRESSURE < ${Math.round(obj.maxPressure * 100)}%`;
    case 'EMERGENCY':
      return 'EMERGENCY';
    case 'QUEUE_LIMIT':
      return `QUEUE ≤ ${obj.maxQueue}`;
  }
}

export function failTitle(reason: FailReason): string {
  switch (reason) {
    case 'crash':
      return 'CRASH!';
    case 'gridlock':
      return 'GRIDLOCK!';
    case 'queue_limit':
      return 'QUEUE OVERFLOW';
    case 'emergency_timeout':
      return 'TOO LATE';
  }
}

export function failSubtitle(reason: FailReason): string {
  switch (reason) {
    case 'crash':
      return 'Two cars collided in the junction';
    case 'gridlock':
      return 'Traffic pressure hit the limit';
    case 'queue_limit':
      return 'A lane stacked up too many waiting cars';
    case 'emergency_timeout':
      return "The ambulance didn't make it through in time";
  }
}

export function isObjectiveType(v: string): v is ObjectiveType {
  return (
    v === 'CLEAR_TRAFFIC' ||
    v === 'SURVIVE' ||
    v === 'PRESSURE_LIMIT' ||
    v === 'EMERGENCY' ||
    v === 'QUEUE_LIMIT'
  );
}
