// Vector de movimiento compartido entre la UI tactil y la escena.
// El joystick en pantalla (hud.ts) lo escribe; WorldScene lo lee y lo suma
// al teclado. Componentes en [-1, 1].
export const touchMove = { x: 0, y: 0 };

// Boton de ataque tactil: el HUD lo aprieta, la escena lo consume (edge-trigger).
export const touchAttack = { pressed: false };

export function isTouchDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0)
  );
}
