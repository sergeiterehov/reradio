export namespace UI {
  export type RadioMode = "FM" | "NFM" | "WFM";
  export type SquelchMode = "Off" | "CTCSS" | "DCS";
  export type ChannelScanMode = "On" | "Off" | "Priority";

  export type Squelch =
    | { mode: "Off" }
    | { mode: "CTCSS"; freq: number }
    | { mode: "DCS"; code: number; polarity: "N" | "I" };

  export namespace Field {
    type _Field<T extends string> = {
      type: T;
      id: string;
      name: string;
      get: () => unknown;
      set: (val: unknown) => void;

      tab?: string;
      description?: string;
    };

    export type Channels = _Field<"channels"> & {
      size: number;
      channel: { get: (i: number) => string };
      empty?: {
        get: (i: number) => boolean;
        init: (i: number) => void;
        delete: (i: number) => void;
      };
      freq?: {
        min?: number;
        max?: number;
        get: (i: number) => number;
        set: (i: number, val: number) => void;
      };
      offset?: {
        get: (i: number) => number;
        set: (i: number, val: number) => void;
      };
      mode?: {
        options: RadioMode[];
        get: (i: number) => RadioMode;
        set: (i: number, val: RadioMode) => void;
      };
      squelch_rx?: {
        options: SquelchMode[];
        get: (i: number) => Squelch;
        set: (i: number, val: Squelch) => void;
      };
      squelch_tx?: {
        options: SquelchMode[];
        get: (i: number) => Squelch;
        set: (i: number, val: Squelch) => void;
      };
      power?: {
        options: number[];
        name?: (val: number) => string;
        get: (i: number) => number;
        set: (i: number, val: number) => void;
      };
      scan?: {
        options: ChannelScanMode[];
        get: (i: number) => ChannelScanMode;
        set: (i: number, val: ChannelScanMode) => void;
      };
    };

    export type Switcher = _Field<"switcher">;
    export type Label = _Field<"label">;
    export type Select = _Field<"select"> & { options: string[]; short?: boolean };
    export type Slider = _Field<"slider"> & { min: number; max: number; label?: (val: number) => string };

    export type Any = Channels | Switcher | Select | Label | Slider;
  }

  export type Root = { fields: Field.Any[] };
}
