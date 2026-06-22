/** ООО «Фронтир Нетворк» */
export const FRONTIR_NETWORK_INN = "5406978329";

export function isFrontirNetworkInn(inn: string): boolean {
  return inn.trim() === FRONTIR_NETWORK_INN;
}
