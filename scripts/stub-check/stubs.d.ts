declare module "react" {
  export function useState<S>(i: S | (() => S)): [S, (v: S | ((p: S) => S)) => void];
  export function useRef<T>(i: T): { current: T };
  export function useRef<T>(i: T | null): { current: T | null };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useEffect(f: () => void | (() => void), d?: readonly unknown[]): void;
  export function useLayoutEffect(f: () => void | (() => void), d?: readonly unknown[]): void;
  export function useMemo<T>(f: () => T, d: readonly unknown[]): T;
  export function useCallback<T extends (...a: any[]) => any>(f: T, d: readonly unknown[]): T;
  export function forwardRef<T, P>(r: (p: P, ref: any) => any): (p: P & { ref?: any }) => any;
  export type ReactNode = any;
  export type CSSProperties = Record<string, any>;
  export type ReactElement = any;
  export type MutableRefObject<T> = { current: T };
  export type RefObject<T> = { current: T | null };
  export type ChangeEvent<T = any> = { target: any };
  export type FormEvent<T = any> = any;
  export type KeyboardEvent<T = any> = any;
  export type PointerEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
  export type TouchEvent<T = any> = any;
  export const StrictMode: any;
}
declare module "react/jsx-runtime" { export const jsx: any, jsxs: any, Fragment: any; }
declare namespace JSX {
  type Element = any; interface IntrinsicElements { [k: string]: any }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: any }
}
declare module "react-dom/client" { export function createRoot(e: any): { render(x: any): void }; }
declare module "three" { export type Group = any; export type Mesh = any; export type Object3D = any; export type Vector3 = any; export type Material = any; export const MathUtils: any; export const Vector3: any; export const Color: any; export type Camera = any; export type Scene = any; export type PerspectiveCamera = any; export type Texture = any; export type Light = any; export type PointLight = any; export type MeshStandardMaterial = any; export type MeshBasicMaterial = any; export type InstancedMesh = any; export type BufferGeometry = any; export const DoubleSide: any; export const BackSide: any; export const AdditiveBlending: any; export const Quaternion: any; export const Euler: any; export const Fog: any; export const FogExp2: any; export const CanvasTexture: any; export const MeshBasicMaterial: any; export const SphereGeometry: any; export const Mesh: any; export const Object3D: any; export const Matrix4: any; export const Raycaster: any; export const Plane: any; export const Clock: any; }
declare module "@react-three/fiber" { export const Canvas: any; export function useFrame(f: (state: any, dt: number) => void): void; export function useThree<T = any>(s?: (st: any) => T): any; }
declare module "colyseus.js" {
  export class Room<S = any> { sessionId: string; state: S; roomId: string; send(t: string, m?: any): void; onMessage(t: string | number, cb: (m: any) => void): () => void; onStateChange: any; onLeave: any; onError: any; leave(c?: boolean): Promise<any>; reconnectionToken: string; }
  export class Client { constructor(u: string); joinOrCreate<S = any>(n: string, o?: any): Promise<Room<S>>; joinById<S = any>(id: string, o?: any): Promise<Room<S>>; create<S = any>(n: string, o?: any): Promise<Room<S>>; reconnect<S = any>(t: string): Promise<Room<S>>; }
}
declare module "express" { const e: any; export default e; export type Request = any; export type Response = any; export type NextFunction = any; export function Router(): any; }
declare module "@colyseus/ws-transport" { export class WebSocketTransport { constructor(o?: any); } }
declare module "@colyseus/schema" {
  export class Schema { constructor(...a: any[]); }
  export class MapSchema<V = any> extends Map<string, V> { toJSON(): any; }
  export class ArraySchema<V = any> extends Array<V> {}
  export function type(...a: any[]): any;
  export function view(...a: any[]): any;
}
declare module "colyseus" {
  export class Client { sessionId: string; send(t: string, m?: any): void; leave(c?: number): void; }
  export class Room<S = any, M = any> {
    state: S; clients: Client[]; roomId: string; maxClients: number; clock: { setTimeout(f: () => void, ms: number): any; setInterval(f: () => void, ms: number): any; currentTime: number };
    setState(s: S): void; setSeatReservationTime(n: number): void; setPatchRate(n: number): void; setSimulationInterval(f: (dt: number) => void, ms?: number): void;
    onMessage(t: string | number, cb: (c: Client, m: any) => void): void; broadcast(t: string, m?: any, o?: any): void; disconnect(): Promise<any>; lock(): Promise<void>; unlock(): Promise<void>;
    allowReconnection(c: Client, s?: number | "manual"): Promise<Client>; setMetadata(m: any): Promise<void>; metadata: any;
    onCreate?(o?: any): void | Promise<void>; onAuth?(c: Client, o?: any, r?: any): any; onJoin?(c: Client, o?: any, a?: any): void | Promise<void>; onLeave?(c: Client, code?: number): void | Promise<void>; onDispose?(): void | Promise<void>;
  }
  export class Server { constructor(o?: any); define(n: string, r: any, o?: any): any; listen(p: number): Promise<void>; }
}
