import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Rapier wrapper — deliberately lightweight (SPEC §0): zero-gravity world
 * whose only job is soft bubble separation, decorative knockback, and
 * (new) reporting bubble-bubble contact events so the game can roll
 * collision-fragility shatters on top of the existing dissipation timer.
 */
export interface PhysicsWorld {
  world: RAPIER.World;
  step(dt: number): void;
  createBubbleBody(
    x: number,
    y: number,
    z: number,
    radius: number,
  ): { body: RAPIER.RigidBody; colliderHandle: number };
  removeBody(body: RAPIER.RigidBody): void;
  /** Contact-start events since the last step, keyed by collider handle. */
  drainCollisions(cb: (handleA: number, handleB: number) => void): void;
}

let rapierReady: Promise<typeof RAPIER> | null = null;

export function initRapier(): Promise<typeof RAPIER> {
  rapierReady ??= RAPIER.init().then(() => RAPIER);
  return rapierReady;
}

export async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const R = await initRapier();
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const eventQueue = new R.EventQueue(true);

  return {
    world,
    step(dt) {
      world.timestep = Math.min(dt, 1 / 30);
      world.step(eventQueue);
    },
    createBubbleBody(x, y, z, radius) {
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(2.2).setCcdEnabled(false),
      );
      const collider = world.createCollider(
        R.ColliderDesc.ball(radius * 1.05).setRestitution(0.6).setFriction(0.05).setDensity(0.4),
        body,
      );
      collider.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      return { body, colliderHandle: collider.handle };
    },
    removeBody(body) {
      world.removeRigidBody(body);
    },
    drainCollisions(cb) {
      eventQueue.drainCollisionEvents((h1, h2, started) => {
        if (started) cb(h1, h2);
      });
    },
  };
}
