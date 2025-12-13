import { Buffer } from "buffer";
import type { Radio } from "./radio";
import { BF888Radio } from "./bf888";
import { RB18Radio, RB618Radio, T18Radio } from "./radtel_t18";
import { UV16Pro8Radio, UV16ProRadio, UV5RRadio, UV82HPRadio, UV82Radio } from "./uv5r";
import { UVK5ProgRadio, UVK5Radio } from "./uvk5";
import { BFC50Radio } from "./bfc50";
import { TK11Radio } from "./tk11";
import { UV5RMiniRadio } from "./uv5r_mini";
import { RT4DRadio } from "./rt4d";

export class Demo_UVK5Radio extends UVK5Radio {
  static Info = {
    ...UVK5Radio.Info,
    vendor: `Demo - ${UVK5Radio.Info.vendor}`,
  };

  constructor() {
    super();
    import("../images/Quansheng_UV-K5.img?hex").then(({ default: img }) => this.load(Buffer.from(img, "hex")));
  }
}

export class Demo_UV5RRadio extends UV5RRadio {
  static Info = {
    ...UV5RRadio.Info,
    vendor: `Demo - ${UV5RRadio.Info.vendor}`,
  };

  constructor() {
    super();
    import("../images/Baofeng_UV-5R.img?hex").then(({ default: img }) => this.load(Buffer.from(img, "hex")));
  }
}

export class Demo_BF888Radio extends BF888Radio {
  static Info = {
    ...BF888Radio.Info,
    vendor: `Demo - ${BF888Radio.Info.vendor}`,
  };

  constructor() {
    super();
    import("../images/Baofeng_BF-888.img?hex").then(({ default: img }) => this.load(Buffer.from(img, "hex")));
  }
}

export class Demo_TK11Radio extends TK11Radio {
  static Info = {
    ...TK11Radio.Info,
    vendor: `Demo - ${TK11Radio.Info.vendor}`,
  };

  constructor() {
    super();
    import("../images/Quansheng_TK11.img?hex").then(({ default: img }) => this.load(Buffer.from(img, "hex")));
  }
}

export class Demo_UV5RMiniRadio extends UV5RMiniRadio {
  static Info = {
    ...UV5RMiniRadio.Info,
    vendor: `Demo - ${UV5RMiniRadio.Info.vendor}`,
  };

  constructor() {
    super();
    import("../images/Baofeng_UV-5R_Mini.img?hex").then(({ default: img }) => this.load(Buffer.from(img, "hex")));
  }
}

export class Demo_RTRT4DRadio extends RT4DRadio {
  static Info = {
    ...RT4DRadio.Info,
    vendor: `Demo - ${RT4DRadio.Info.vendor}`,
  };

  constructor() {
    super();
    import("../images/Radtel_RT-4D_v3.img?hex").then(({ default: img }) => this.load(Buffer.from(img, "hex")));
  }
}

export const Library: (typeof Radio)[] = [
  BF888Radio,
  BFC50Radio,
  UV5RRadio,
  UV5RMiniRadio,
  UV82Radio,
  UV82HPRadio,
  UV16ProRadio,
  UV16Pro8Radio,
  UVK5Radio,
  UVK5ProgRadio,
  TK11Radio,
  T18Radio,
  RT4DRadio,
  RB18Radio,
  RB618Radio,
  Demo_BF888Radio,
  Demo_UV5RRadio,
  Demo_UV5RMiniRadio,
  Demo_UVK5Radio,
  Demo_TK11Radio,
  Demo_RTRT4DRadio,
];
