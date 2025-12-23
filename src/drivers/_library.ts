import type { Radio } from "./_radio";
import { BF888Radio } from "./bf888";
import { RB18Radio, RB618Radio, T18Radio } from "./radtel_t18";
import { UV16ProHPRadio, UV16ProRadio, UV5RRadio, UV82HPRadio, UV82Radio } from "./uv5r";
import { UVK5ProgRadio, UVK5Radio } from "./uvk5";
import { BFC50Radio } from "./bfc50";
import { TK11Radio } from "./tk11";
import { UV5RMiniRadio } from "./uv5r_mini";
import { RT4DRadio } from "./rt4d";
import { RA89Radio, THUV88Radio, THUV98Radio, THUV99Radio } from "./thuv88";

export const Library: (typeof Radio)[] = [
  BF888Radio,
  BFC50Radio,
  UV5RRadio,
  UV5RMiniRadio,
  UV82Radio,
  UV82HPRadio,
  UV16ProRadio,
  UV16ProHPRadio,
  UVK5Radio,
  UVK5ProgRadio,
  TK11Radio,
  T18Radio,
  RT4DRadio,
  RB18Radio,
  RB618Radio,
  THUV88Radio,
  THUV98Radio,
  THUV99Radio,
  RA89Radio,
];
