/** Firebase-free core boundary. Only client initialization installs its live guard.
 * Trusted server computations never install it and therefore reject software inputs.
 */
let check: () => boolean = () => false;
export function registerSoftwareSeasonEnvironment(
  checkEnvironment: () => boolean
) {
  check = checkEnvironment;
}
export const isSoftwareSeasonEnvironment = () => check();
