import { NUMPY_RAND_MAX, NUMPY_RAND_MIN } from './constants';

export function generateSeed() {
  return Math.floor(
    Math.random() * (NUMPY_RAND_MAX - NUMPY_RAND_MIN + 1) + NUMPY_RAND_MIN,
  );
}
