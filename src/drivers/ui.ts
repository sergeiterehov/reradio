export namespace UI {
  export namespace Field {
    type _Field<T extends string> = {
      type: T;
      id: string;
      name: string;
      get: () => unknown;
      set: (val: unknown) => void;
    };

    export type Switcher = _Field<"switcher">;
    export type Select<V = unknown> = _Field<"select"> & { options: { value: V; name: string }[] };

    export type Any = Switcher | Select;
  }
}
