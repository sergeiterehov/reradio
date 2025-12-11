export namespace UI {
  export type RadioMode = "FM" | "NFM" | "WFM" | "AM" | "NAM" | "SSB";
  export type ScanMode = "On" | "Off";
  export type PttIdOn = "Off" | "Begin" | "End" | "BeginAndEnd";
  export type DMRSlot = "Slot-1" | "Slot-2" | "DualSlot";

  export type DMRContactType = "Individual" | "Group";
  export type DMRContact = { type: DMRContactType; id: number; name: string };

  export type DMREncryptionType = "Off" | "ARC" | "AES-128" | "AES-256";
  export type DMREncryption = { name: string; type: DMREncryptionType };

  export type Squelch =
    | { mode: "Off" }
    | { mode: "CTCSS"; freq: number }
    | { mode: "DCS"; code: number; polarity: "N" | "I" };
  export type SquelchMode = Squelch["mode"];

  export type DMR_ID = { from: "Radio" } | { from: "Channel"; id: number };
  export type DMR_IDFrom = DMR_ID["from"];

  export namespace Field {
    type _Field<T extends string> = {
      type: T;
      id: string;
      name: string;

      tab?: string;
      description?: string;
    };

    export type None = _Field<"none">;
    export type Cargo = _Field<"cargo"> & { get: () => unknown; set: (val: unknown) => void };

    export type Channels = _Field<"channels"> & {
      size: number;
      channel: { get: (i: number) => string; set?: (i: number, val: string) => void };
      extra?: (i: number) => Field.Any[];
      empty?: {
        get: (i: number) => boolean;
        init: (i: number) => void;
        delete: (i: number) => void;
      };
      digital?: {
        get: (i: number) => boolean;
        set?: (i: number, val: boolean) => void;
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
      dmr_id?: {
        from: DMR_IDFrom[];
        get: (i: number) => DMR_ID;
        set: (i: number, val: DMR_ID) => void;
      };
      dmr_rx_list?: {
        lists: string[];
        get: (i: number) => number;
        set: (i: number, i_group: number) => void;
      };
      dmr_contact?: {
        contacts: () => DMRContact[];
        get: (i: number) => number;
        set: (i: number, i_contact: number) => void;
      };
      dmr_slot?: {
        options: DMRSlot[];
        get: (i: number) => number;
        set: (i: number, i_option: number) => void;
      };
      dmr_color_code?: {
        get: (i: number) => number;
        set: (i: number, code: number) => void;
      };
      dmr_encryption?: {
        keys: () => DMREncryption[];
        get: (i: number) => { key_index: number };
        set: (i: number, val: { key_index: number }) => void;
      };
    };

    export type Contacts = _Field<"contacts"> & {
      size: number;
      get: (i: number) => DMRContact | undefined;
      set?: (i: number, val: DMRContact) => void;
      delete?: (i: number) => void;
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
    export type Table = _Field<"table"> & {
      header: () => { [k: string]: { name: string } };
      size: () => number;
      get: (i: number) => { [k: string]: string } | undefined;
      set_ui?: (i: number) => Field.Any[];
      delete?: (i: number) => void;
    };

    export type Any =
      | None
      | Cargo
      | Channels
      | Contacts
      | Switcher
      | Select
      | Label
      | Slider
      | Text
      | Chars
      | File
      | Table;
  }

  export type Root = { fields: Field.Any[] };
}
