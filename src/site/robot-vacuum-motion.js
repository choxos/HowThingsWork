/**
 * Exact planar no-slip motion for constant wheel velocities over one interval.
 * Wheel speeds and cumulative wheel travel are signed, in meters and seconds.
 * The reference point is halfway between the driven wheels. Positive heading
 * turns left, so the right wheel contributes positive angular velocity.
 * Reference: Lynch and Park, Modern Robotics, section 13.4 (odometry).
 */
export function differentialStep(pose, leftSpeed, rightSpeed, seconds, wheelBase) {
  const {x, y, h, leftTravel = 0, rightTravel = 0, distance = 0} = pose;
  if (![x, y, h, leftTravel, rightTravel, distance, leftSpeed, rightSpeed, seconds, wheelBase].every(Number.isFinite)
      || seconds < 0 || wheelBase <= 0 || distance < 0) {
    throw new RangeError('Invalid differential-drive state or interval.');
  }
  const left = leftSpeed * seconds, right = rightSpeed * seconds;
  const turn = (right - left) / wheelBase, travel = (left + right) / 2, half = turn / 2;
  // The sinc form is well conditioned for almost equal wheel speeds.
  const chord = travel * (half === 0 ? 1 : Math.sin(half) / half);
  return {
    x: x + chord * Math.cos(h + half),
    y: y + chord * Math.sin(h + half),
    h: h + turn,
    leftTravel: leftTravel + left,
    rightTravel: rightTravel + right,
    distance: distance + Math.abs(travel),
  };
}
