const ID = import.meta.env.VITE_YANDEX_METRIKA;

const stack: unknown[] = [];

const _ym = (...args: unknown[]) => stack.push(args);
_ym.a = stack;
_ym.l = Number(new Date());

Object.assign(window, { ym: _ym });

if (ID) {
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.appendChild(script);

  ym(ID, "init", { clickmap: true, accurateTrackBounce: true, trackLinks: true });
}

const YaMetrika = {
  Goal: {
    TryReadFromRadio: "try_read",
    SuccessReadFromRadio: "success_read",
    TryWriteToRadio: "try_write",
    SuccessWriteToRadio: "success_write",
  },
  richGoal: (target: string, params?: { [k: string]: unknown }) => ym(ID, "reachGoal", target, params),
};

export default YaMetrika;
