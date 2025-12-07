export namespace UI {
  export type RadioMode = "FM" | "NFM" | "WFM" | "AM" | "NAM" | "SSB";
  export type SquelchMode = "Off" | "CTCSS" | "DCS";
  export type ScanMode = "On" | "Off";
  export type PttIdOn = "Off" | "Begin" | "End" | "BeginAndEnd";

  export type Squelch =
    | { mode: "Off" }
    | { mode: "CTCSS"; freq: number }
    | { mode: "DCS"; code: number; polarity: "N" | "I" };

  export namespace Field {
    type _Field<T extends string> = {
      type: T;
      id: string;
      name: string;

      tab?: string;
      description?: string;
    };

    export type None = _Field<"none">;

    export type Channels = _Field<"channels"> & {
      size: number;
      channel: { get: (i: number) => string; set?: (i: number, val: string) => void };
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
        get: (i: number) => number;
        set: (i: number, i_option: number) => void;
      };
      squelch_rx?: {
        options: SquelchMode[];
        codes?: number[];
        tones?: number[];
        get: (i: number) => Squelch;
        set: (i: number, val: Squelch) => void;
      };
      squelch_tx?: {
        options: SquelchMode[];
        codes?: number[];
        get: (i: number) => Squelch;
        set: (i: number, val: Squelch) => void;
      };
      power?: {
        options: number[];
        name?: (val: number) => string;
        get: (i: number) => number;
        set: (i: number, i_option: number) => void;
      };
      scan?: {
        options: ScanMode[];
        get: (i: number) => number;
        set: (i: number, i_option: number) => void;
      };
      bcl?: {
        get: (i: number) => boolean;
        set: (i: number, val: boolean) => void;
      };
      ptt_id?: {
        on_options: PttIdOn[];
        id_options: string[];
        get: (i: number) => { on: number; id: number };
        set: (i: number, val: { on: number; id: number }) => void;
      };
    };

    export type Switcher = _Field<"switcher"> & { get: () => boolean; set: (val: boolean) => void };
    export type Label = _Field<"label"> & { get: () => unknown };
    export type Select = _Field<"select"> & {
      options: string[];
      short?: boolean;
      get: () => number;
      set: (val: number) => void;
    };
    export type Slider = _Field<"slider"> & {
      min: number;
      max: number;
      label?: (val: number) => string;
      get: () => number;
      set: (val: number) => void;
    };
    export type Text = _Field<"text"> & { get: () => string; set: (val: string) => void };
    export type Chars = _Field<"chars"> & {
      abc: string;
      pad: string;
      length: number;
      uppercase?: boolean;
      get: () => number[];
      set: (val: number[]) => void;
    };
    export type File = _Field<"file"> & {
      get: () => globalThis.File | undefined;
      set: (val: globalThis.File | undefined) => void;
    };

    export type Any = None | Channels | Switcher | Select | Label | Slider | Text | Chars | File;
  }

  export type Root = { fields: Field.Any[] };
}
