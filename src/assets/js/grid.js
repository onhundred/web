(() => {
  const grid = document.querySelector("[data-grid]");
  const hero = document.querySelector("[data-readout]");
  if (!grid || !hero) return;

  const figure = hero.querySelector("[data-figure]");
  const caption = hero.querySelector("[data-caption]");
  const tag = caption.nextElementSibling;
  const note = document.querySelector("[data-stage-note]");
  const areaButtons = [...document.querySelectorAll("[data-area-btn]")];
  const showButtons = [...document.querySelectorAll("[data-show-btn]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const total = Number(hero.dataset.total);
  const state = { area: null, show: null };
  let current = total;
  let frame = 0;

  const countTo = (target) => {
    cancelAnimationFrame(frame);
    if (reduced.matches || target === current) {
      current = target;
      figure.textContent = target + "%";
      return;
    }
    const from = current;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 480);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      current = Math.round(from + (target - from) * eased);
      figure.textContent = current + "%";
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  // Longer area captions must stay on one line: a wrap would move the grid under the pointer.
  const fitCaption = () => {
    caption.style.fontSize = "";
    let size = parseFloat(getComputedStyle(caption).fontSize);
    const fits = () =>
      caption.offsetHeight <= size * 1.5 &&
      (!tag || tag.offsetTop < caption.offsetTop + caption.offsetHeight);
    while (!fits() && size > 11) {
      size -= 0.5;
      caption.style.fontSize = size + "px";
    }
  };

  const apply = (area, show) => {
    if (area) grid.dataset.areaFocus = area;
    else delete grid.dataset.areaFocus;
    if (show) grid.dataset.show = show;
    else delete grid.dataset.show;

    const areaButton = area && areaButtons.find((b) => b.dataset.areaBtn === area);
    countTo(areaButton ? Number(areaButton.dataset.pct) : total);
    const text = areaButton ? areaButton.dataset.caption : hero.dataset.totalCaption;
    if (caption.textContent !== text) {
      caption.textContent = text;
      fitCaption();
    }

    const showButton = show && showButtons.find((b) => b.dataset.showBtn === show);
    if (note) note.textContent = showButton && showButton.dataset.note ? showButton.dataset.note : note.dataset.default;
  };

  const sync = () => {
    areaButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.areaBtn === state.area)));
    showButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.showBtn === state.show)));
    apply(state.area, state.show);
  };

  const preview = (button, area, show) => {
    button.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") apply(area, show);
    });
    button.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") apply(state.area, state.show);
    });
  };

  areaButtons.forEach((b) => {
    const key = b.dataset.areaBtn;
    b.addEventListener("click", () => {
      state.area = state.area === key ? null : key;
      state.show = null;
      sync();
    });
    preview(b, key, null);
  });

  showButtons.forEach((b) => {
    const key = b.dataset.showBtn;
    b.addEventListener("click", () => {
      state.show = state.show === key ? null : key;
      state.area = null;
      sync();
    });
    preview(b, null, key);
  });

  // Loop tooltip: hover with a mouse, tap on touch screens.
  const labels = JSON.parse(grid.dataset.tip || "{}");
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  document.body.append(tip);
  let tipCell = null;

  const hideTip = () => {
    tipCell = null;
    delete tip.dataset.on;
  };

  const showTip = (cell) => {
    if (!cell || !cell.dataset.loop) return hideTip();
    if (cell === tipCell) return;
    tipCell = cell;
    const d = cell.dataset;
    const lines = [
      ["tip-code", d.loop],
      ["tip-name", d.name],
      ["", labels.levels && labels.levels[d.s]],
      ["tip-flag", labels.flags && labels.flags[d.flag]],
      ["failed" in d ? "tip-failed" : "", labels.outcomes && labels.outcomes[d.o]],
    ];
    tip.replaceChildren(
      ...lines
        .filter((l) => l[1])
        .map(([cls, text]) => {
          const s = document.createElement("span");
          s.className = cls;
          s.textContent = text;
          return s;
        })
    );
    tip.dataset.on = "";
    const r = cell.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    const y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  };

  grid.addEventListener("pointerover", (e) => {
    if (e.pointerType === "mouse") showTip(e.target.closest(".cell"));
  });
  grid.addEventListener("pointerleave", hideTip);
  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.stopPropagation();
    if (cell === tipCell) hideTip();
    else showTip(cell);
  });
  document.addEventListener("click", hideTip);
  addEventListener("scroll", hideTip, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    hideTip();
    if (state.area || state.show) {
      state.area = null;
      state.show = null;
      sync();
    }
  });
})();
