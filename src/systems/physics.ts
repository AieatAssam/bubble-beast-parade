import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Rapier wrapper — deliberately lightweight (SPEC §0): zero-gravity world
 * whose only job is soft bubble separation and decorative knockback.
 */
export interface PhysicsWorld {
  world: RAPIER.World;
  step(dt: number): void;
  createBubbleBody(x: number, y: number, z: number, radius: number): RAPIER.RigidBody;
  removeBody(body: RAPIER.RigidBody): void;
}

let rapierReady: Promise<typeof RAPIER> | null = null;

export function initRapier(): Promise<typeof RAPIER> {
  rapierReady ??= RAPIER.init().then(() => RAPIER);
  return rapierReady;
}

export async function createPhysicsWorld(): Promise<PhysicsWorld> {
  const R = await initRapier();
  const world = new R.World({ x: 0, y: 0, z: 0 });

  return {
    world,
    step(dt) {
      world.timestep = Math.min(dt, 1 / 30);
      world.step();
    },
    createBubbleBody(x, y, z, radius) {
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(2.2).setCcdEnabled(false),
      );
      world.createCollider(
        R.ColliderDesc.ball(radius * 1.05).setRestitution(0.4).setFriction(0).setDensity(0.4),
        body,
      );
      return body;
    },
    removeBody(body) {
      world.removeRigidBody(body);
    },
  };
}
