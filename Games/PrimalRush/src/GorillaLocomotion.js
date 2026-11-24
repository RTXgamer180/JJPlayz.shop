import * as THREE from "three";

const GRAVITY = new THREE.Vector3(0, -9.8, 0);

export class GorillaLocomotion {
  constructor(options) {
    this.rig = options.rig;
    this.head = options.head;
    this.leftHand = options.leftHand;
    this.rightHand = options.rightHand;
    this.leftFollower = options.leftFollower;
    this.rightFollower = options.rightFollower;
    this.bodyHeight = options.bodyHeight ?? 1.1;
    this.bodyRadius = options.bodyRadius ?? 0.22;
    this.headRadius = options.headRadius ?? 0.18;
    this.handRadius = options.handRadius ?? 0.05;
    this.maxArmLength = options.maxArmLength ?? 1.5;
    this.unStickDistance = options.unStickDistance ?? 1.0;
    this.velocityHistorySize = options.velocityHistorySize ?? 12;
    this.velocityLimit = options.velocityLimit ?? 1.25;
    this.maxJumpSpeed = options.maxJumpSpeed ?? 7.5;
    this.jumpMultiplier = options.jumpMultiplier ?? 1.85;
    this.minimumRaycastDistance = options.minimumRaycastDistance ?? 0.05;
    this.defaultSlideFactor = options.defaultSlideFactor ?? 0.03;
    this.defaultPrecision = options.defaultPrecision ?? 0.995;
    this.surfaces = options.surfaces ?? [];

    this.velocityHistory = Array.from(
      { length: this.velocityHistorySize },
      () => new THREE.Vector3()
    );
    this.velocityIndex = 0;
    this.denormalizedVelocityAverage = new THREE.Vector3();
    this.currentVelocity = new THREE.Vector3();
    this.playerVelocity = new THREE.Vector3();
    this.lastPosition = new THREE.Vector3();

    this.leftHandWorld = new THREE.Vector3();
    this.rightHandWorld = new THREE.Vector3();
    this.headWorld = new THREE.Vector3();
    this.currentLeftHandPosition = new THREE.Vector3();
    this.currentRightHandPosition = new THREE.Vector3();
    this.handOffset = new THREE.Vector3();
    this.lastLeftHandPosition = new THREE.Vector3();
    this.lastRightHandPosition = new THREE.Vector3();
    this.lastHeadPosition = new THREE.Vector3();

    this.finalPosition = new THREE.Vector3();
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.tmpC = new THREE.Vector3();
    this.tmpD = new THREE.Vector3();
    this.tmpE = new THREE.Vector3();
    this.tmpBox = new THREE.Box3();
    this.hitNormal = new THREE.Vector3();
    this.headCollisionNormal = new THREE.Vector3();
    this.leftHandColliding = false;
    this.rightHandColliding = false;
    this.wasLeftHandTouching = false;
    this.wasRightHandTouching = false;
  }

  initialize() {
    this.leftHand.getWorldPosition(this.leftHandWorld);
    this.rightHand.getWorldPosition(this.rightHandWorld);
    this.head.getWorldPosition(this.headWorld);

    this.lastLeftHandPosition.copy(this.leftHandWorld);
    this.lastRightHandPosition.copy(this.rightHandWorld);
    this.lastHeadPosition.copy(this.headWorld);
    this.lastPosition.copy(this.rig.position);
    this.leftFollower.position.copy(this.lastLeftHandPosition);
    this.rightFollower.position.copy(this.lastRightHandPosition);
  }

  update(deltaSeconds) {
    const dt = Math.max(1 / 144, Math.min(deltaSeconds || 1 / 72, 1 / 30));

    this.applyInertia(dt);

    this.leftHand.getWorldPosition(this.leftHandWorld);
    this.rightHand.getWorldPosition(this.rightHandWorld);
    this.head.getWorldPosition(this.headWorld);

    const currentLeftHandPosition = this.getClampedHandPosition(
      this.leftHandWorld,
      this.currentLeftHandPosition
    );
    const currentRightHandPosition = this.getClampedHandPosition(
      this.rightHandWorld,
      this.currentRightHandPosition
    );

    const gravityStep = this.tmpC.copy(GRAVITY).multiplyScalar(2 * dt * dt);
    const firstIterationLeft = new THREE.Vector3();
    const firstIterationRight = new THREE.Vector3();

    this.leftHandColliding = false;
    this.rightHandColliding = false;

    const leftTravel = this.tmpD
      .copy(currentLeftHandPosition)
      .sub(this.lastLeftHandPosition)
      .add(gravityStep);

    if (
      this.iterativeCollisionSweep(
        this.lastLeftHandPosition,
        this.minimumRaycastDistance,
        leftTravel,
        this.defaultPrecision,
        true
      )
    ) {
      if (this.wasLeftHandTouching) {
        firstIterationLeft.copy(this.lastLeftHandPosition).sub(currentLeftHandPosition);
      } else {
        firstIterationLeft.copy(this.finalPosition).sub(currentLeftHandPosition);
      }
      this.playerVelocity.set(0, 0, 0);
      this.leftHandColliding = true;
    }

    const rightTravel = this.tmpE
      .copy(currentRightHandPosition)
      .sub(this.lastRightHandPosition)
      .add(gravityStep);

    if (
      this.iterativeCollisionSweep(
        this.lastRightHandPosition,
        this.minimumRaycastDistance,
        rightTravel,
        this.defaultPrecision,
        true
      )
    ) {
      if (this.wasRightHandTouching) {
        firstIterationRight.copy(this.lastRightHandPosition).sub(currentRightHandPosition);
      } else {
        firstIterationRight.copy(this.finalPosition).sub(currentRightHandPosition);
      }
      this.playerVelocity.set(0, 0, 0);
      this.rightHandColliding = true;
    }

    let rigidBodyMovement = new THREE.Vector3();
    const bothHandsActive =
      (this.leftHandColliding || this.wasLeftHandTouching) &&
      (this.rightHandColliding || this.wasRightHandTouching);

    if (bothHandsActive) {
      rigidBodyMovement.copy(firstIterationLeft).add(firstIterationRight).multiplyScalar(0.5);
    } else {
      rigidBodyMovement.copy(firstIterationLeft).add(firstIterationRight);
    }

    const headMovement = this.tmpA
      .copy(this.headWorld)
      .add(rigidBodyMovement)
      .sub(this.lastHeadPosition);

    if (
      this.iterativeCollisionSweep(
        this.lastHeadPosition,
        this.headRadius,
        headMovement,
        this.defaultPrecision,
        false
      )
    ) {
      rigidBodyMovement.copy(this.finalPosition).sub(this.lastHeadPosition);
      const probe = this.tmpB
        .copy(this.headWorld)
        .sub(this.lastHeadPosition)
        .add(rigidBodyMovement);
      if (this.rayIntersectsAnySurface(this.lastHeadPosition, probe, this.headRadius * this.defaultPrecision * 0.999)) {
        rigidBodyMovement.copy(this.lastHeadPosition).sub(this.headWorld);
      }
    }

    if (rigidBodyMovement.lengthSq() > 0) {
      this.rig.position.add(rigidBodyMovement);
      this.head.getWorldPosition(this.headWorld);
    }

    this.lastHeadPosition.copy(this.headWorld);

    const allowSlideLeft = !bothHandsActive;
    const finalLeftTravel = this.tmpC.copy(currentLeftHandPosition).sub(this.lastLeftHandPosition);
    if (
      this.iterativeCollisionSweep(
        this.lastLeftHandPosition,
        this.minimumRaycastDistance,
        finalLeftTravel,
        this.defaultPrecision,
        allowSlideLeft
      )
    ) {
      this.lastLeftHandPosition.copy(this.finalPosition);
      this.leftHandColliding = true;
    } else {
      this.lastLeftHandPosition.copy(currentLeftHandPosition);
    }

    const finalRightTravel = this.tmpD.copy(currentRightHandPosition).sub(this.lastRightHandPosition);
    if (
      this.iterativeCollisionSweep(
        this.lastRightHandPosition,
        this.minimumRaycastDistance,
        finalRightTravel,
        this.defaultPrecision,
        allowSlideLeft
      )
    ) {
      this.lastRightHandPosition.copy(this.finalPosition);
      this.rightHandColliding = true;
    } else {
      this.lastRightHandPosition.copy(currentRightHandPosition);
    }

    this.storeVelocities(dt);

    if ((this.rightHandColliding || this.leftHandColliding) && this.denormalizedVelocityAverage.length() > this.velocityLimit) {
      const launchSpeed = Math.min(
        this.denormalizedVelocityAverage.length() * this.jumpMultiplier,
        this.maxJumpSpeed
      );
      this.playerVelocity.copy(this.denormalizedVelocityAverage).normalize().multiplyScalar(launchSpeed);
    }

    if (
      this.leftHandColliding &&
      currentLeftHandPosition.distanceTo(this.lastLeftHandPosition) > this.unStickDistance &&
      !this.segmentBlocked(this.headWorld, currentLeftHandPosition, this.minimumRaycastDistance * this.defaultPrecision)
    ) {
      this.lastLeftHandPosition.copy(currentLeftHandPosition);
      this.leftHandColliding = false;
    }

    if (
      this.rightHandColliding &&
      currentRightHandPosition.distanceTo(this.lastRightHandPosition) > this.unStickDistance &&
      !this.segmentBlocked(this.headWorld, currentRightHandPosition, this.minimumRaycastDistance * this.defaultPrecision)
    ) {
      this.lastRightHandPosition.copy(currentRightHandPosition);
      this.rightHandColliding = false;
    }

    this.leftFollower.position.copy(this.lastLeftHandPosition);
    this.rightFollower.position.copy(this.lastRightHandPosition);
    this.wasLeftHandTouching = this.leftHandColliding;
    this.wasRightHandTouching = this.rightHandColliding;
  }

  applyInertia(dt) {
    if (this.playerVelocity.lengthSq() === 0) {
      return;
    }

    const step = this.tmpA.copy(this.playerVelocity).multiplyScalar(dt);
    if (
      this.iterativeCollisionSweep(
        this.lastHeadPosition,
        this.headRadius,
        step,
        this.defaultPrecision,
        false
      )
    ) {
      this.playerVelocity.set(0, 0, 0);
      return;
    }

    this.rig.position.add(step);
    this.playerVelocity.multiplyScalar(0.985);
    if (this.playerVelocity.lengthSq() < 0.0004) {
      this.playerVelocity.set(0, 0, 0);
    }
  }

  getClampedHandPosition(worldPosition, target) {
    this.head.getWorldPosition(this.headWorld);
    target.copy(worldPosition);
    const offset = this.handOffset.copy(target).sub(this.headWorld);
    if (offset.length() > this.maxArmLength) {
      offset.setLength(this.maxArmLength);
      target.copy(this.headWorld).add(offset);
    }
    return target;
  }

  iterativeCollisionSweep(startPosition, sphereRadius, movementVector, precision, singleHand) {
    const hit = this.collisionsSweep(
      startPosition,
      sphereRadius * precision,
      movementVector,
      precision
    );

    if (hit) {
      const firstPosition = this.finalPosition.clone();
      const slipPercentage =
        hit.surface?.slipPercentage ??
        (!singleHand ? this.defaultSlideFactor : 0.001);
      const remaining = this.tmpA.copy(startPosition).add(movementVector).sub(firstPosition);
      const movementOnPlane = remaining.projectOnPlane(hit.normal).multiplyScalar(slipPercentage);

      if (this.collisionsSweep(this.finalPosition, sphereRadius, movementOnPlane, precision * precision)) {
        return true;
      }

      const movedFirst = this.tmpB.copy(movementOnPlane).add(firstPosition);
      const towardTrue = this.tmpC.copy(startPosition).add(movementVector).sub(movedFirst);
      if (this.collisionsSweep(movedFirst, sphereRadius, towardTrue, precision * precision * precision)) {
        return true;
      }

      this.finalPosition.copy(firstPosition);
      return true;
    }

    const direction = this.tmpD.copy(movementVector);
    const magnitude = direction.length();
    if (magnitude === 0) {
      return false;
    }
    direction.normalize().multiplyScalar(magnitude + sphereRadius * precision * 0.34);

    if (
      this.collisionsSweep(
        startPosition,
        sphereRadius * precision * 0.66,
        direction,
        precision * 0.66
      )
    ) {
      this.finalPosition.copy(startPosition);
      return true;
    }

    this.finalPosition.set(0, 0, 0);
    return false;
  }

  collisionsSweep(startPosition, sphereRadius, movementVector, precision) {
    const hit = this.findSurfaceHit(
      startPosition,
      sphereRadius * precision,
      movementVector,
      movementVector.length() + sphereRadius * (1 - precision)
    );

    if (hit) {
      this.finalPosition.copy(hit.point).addScaledVector(hit.normal, sphereRadius);
      const toFinal = this.tmpA.copy(this.finalPosition).sub(startPosition);
      const innerHit = this.findSurfaceHit(
        startPosition,
        sphereRadius * precision * precision,
        toFinal,
        toFinal.length() + sphereRadius * (1 - precision * precision)
      );

      if (innerHit) {
        const adjustedDistance = Math.max(
          0,
          hit.distance - sphereRadius * (1 - precision * precision)
        );
        this.finalPosition
          .copy(toFinal)
          .normalize()
          .multiplyScalar(adjustedDistance)
          .add(startPosition);
        this.hitNormal.copy(innerHit.normal);
        return innerHit;
      }

      if (
        this.rayIntersectsAnySurface(
          startPosition,
          toFinal,
          sphereRadius * precision * precision * 0.999
        )
      ) {
        this.finalPosition.copy(startPosition);
        return hit;
      }

      this.hitNormal.copy(hit.normal);
      return hit;
    }

    if (this.rayIntersectsAnySurface(startPosition, movementVector, sphereRadius * precision * 0.999)) {
      this.finalPosition.copy(startPosition);
      return { normal: this.headCollisionNormal, point: startPosition, distance: 0, surface: null };
    }

    this.finalPosition.set(0, 0, 0);
    return null;
  }

  findSurfaceHit(startPosition, sphereRadius, movementVector, maxDistance) {
    const length = movementVector.length();
    if (length === 0) {
      return null;
    }

    const direction = this.tmpA.copy(movementVector).normalize();
    let bestHit = null;

    for (const surface of this.surfaces) {
      this.tmpBox.copy(surface.box).expandByScalar(sphereRadius);
      const hit = intersectSegmentBox(startPosition, direction, maxDistance, this.tmpBox);
      if (!hit) {
        continue;
      }
      if (!bestHit || hit.distance < bestHit.distance) {
        bestHit = {
          distance: hit.distance,
          point: hit.point,
          normal: hit.normal,
          surface
        };
      }
    }

    return bestHit;
  }

  rayIntersectsAnySurface(startPosition, movementVector, maxDistance) {
    const length = movementVector.length();
    if (length === 0) {
      return false;
    }

    const direction = this.tmpA.copy(movementVector).normalize();
    let found = false;
    let nearest = Infinity;

    for (const surface of this.surfaces) {
      const hit = intersectSegmentBox(startPosition, direction, maxDistance || length, surface.box);
      if (!hit) {
        continue;
      }
      if (hit.distance < nearest) {
        nearest = hit.distance;
        this.headCollisionNormal.copy(hit.normal);
        found = true;
      }
    }

    return found;
  }

  segmentBlocked(startPosition, endPosition, radius) {
    const movement = this.tmpA.copy(endPosition).sub(startPosition);
    const length = movement.length();
    if (length <= radius) {
      return false;
    }
    return !!this.findSurfaceHit(startPosition, radius, movement, length - radius);
  }

  storeVelocities(dt) {
    this.velocityIndex = (this.velocityIndex + 1) % this.velocityHistorySize;
    const oldestVelocity = this.velocityHistory[this.velocityIndex];
    this.currentVelocity.copy(this.rig.position).sub(this.lastPosition).multiplyScalar(1 / dt);
    this.denormalizedVelocityAverage.add(
      this.tmpA.copy(this.currentVelocity).sub(oldestVelocity).multiplyScalar(1 / this.velocityHistorySize)
    );
    oldestVelocity.copy(this.currentVelocity);
    this.lastPosition.copy(this.rig.position);
  }
}

function intersectSegmentBox(origin, direction, maxDistance, box) {
  let tMin = 0;
  let tMax = maxDistance;
  let hitAxis = -1;
  let hitSign = 1;

  for (let axis = 0; axis < 3; axis += 1) {
    const o = origin.getComponent(axis);
    const d = direction.getComponent(axis);
    const min = box.min.getComponent(axis);
    const max = box.max.getComponent(axis);

    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) {
        return null;
      }
      continue;
    }

    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    let entrySign = -1;

    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
      entrySign = 1;
    }

    if (t1 > tMin) {
      tMin = t1;
      hitAxis = axis;
      hitSign = entrySign;
    }
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) {
      return null;
    }
  }

  if (tMin < 0 || tMin > maxDistance) {
    return null;
  }

  const point = new THREE.Vector3().copy(direction).multiplyScalar(tMin).add(origin);
  const normal = new THREE.Vector3();
  if (hitAxis !== -1) {
    normal.setComponent(hitAxis, hitSign);
  }

  return {
    distance: tMin,
    point,
    normal
  };
        }
