export namespace UI {
  export type RadioMode = "FM" | "NFM" | "WFM";

  export namespace Field {
    type _Field<T extends string> = {
      type: T;
      id: string;
      name: string;
      get: () => unknown;
      set: (val: unknown) => void;

      tab?: string;
    };

    export type Channels = _Field<"channels"> & {
      size: number;
      channel: { get: (i: number) => string };
      freq?: {
        get: (i: number) => number;
        set: (i: number, val: number) => void;
      };
      mode?: {
        options: RadioMode[];
        get: (i: number) => RadioMode;
        set: (i: number, val: RadioMode) => void;
      };
    };

    export type Switcher = _Field<"switcher">;
    export type Select<V = unknown> = _Field<"select"> & { options: { value: V; name: string }[] };

    export type Any = Channels | Switcher | Select;
  }
}
