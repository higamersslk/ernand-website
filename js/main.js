/* ==========================================================================
   Ernand Rocha — comportamento do site
   Sem dependências. Cada bloco é uma função init* chamada no fim.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- utilidades ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const DATA = window.EA_DATA || { topics: [], therapists: [], articles: [] };
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id, cls) => `<svg class="${cls || ""}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
  const topicBySlug = (slug) => DATA.topics.find((t) => t.slug === slug);
  const fmtDate = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  };
  const params = new URLSearchParams(location.search);
  // Em file:// o navegador bloqueia history.replaceState; nunca deixe isso derrubar o resto.
  const replaceUrl = (url) => { try { history.replaceState(null, "", url); } catch (e) { /* ignorado */ } };
  const smoothTo = (el) => el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });

  /* ---------- navegação ---------- */
  function initNav() {
    const nav = $(".nav");
    const toggle = $(".nav__toggle");
    const links = $(".nav__links");
    if (!nav) return;

    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle && links) {
      const setOpen = (open) => {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
        links.classList.toggle("is-open", open);
        document.body.classList.toggle("menu-open", open);
        if (open) { const first = links.querySelector("a"); if (first) first.focus({ preventScroll: true }); }
      };
      toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
      links.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && links.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
      });
      window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
    }

    // marca a página/seção atual
    const here = location.pathname.split("/").pop() || "index.html";
    const anchors = $$(".nav__links a");
    anchors.forEach((a) => {
      const [file, hash] = a.getAttribute("href").split("#");
      if (file === here && !hash) a.setAttribute("aria-current", "page");
    });
    if (here === "index.html" && "IntersectionObserver" in window) {
      const map = new Map();
      anchors.forEach((a) => { const h = a.getAttribute("href").split("#")[1]; const sec = h && document.getElementById(h); if (sec && !a.classList.contains("nav__cta")) map.set(sec, a); });
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          anchors.forEach((a) => a.removeAttribute("aria-current"));
          const a = map.get(en.target); if (a) a.setAttribute("aria-current", "location");
        });
      }, { rootMargin: "-40% 0px -55% 0px" });
      map.forEach((_, sec) => io.observe(sec));
    }
  }

  /* ---------- revelar ao rolar ---------- */
  function initReveal() {
    const items = $$("[data-reveal]");
    if (!items.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: .1 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- paralaxe leve (hero) ---------- */
  function initParallax() {
    const els = $$("[data-parallax]");
    if (!els.length || REDUCED) return;
    let raf = null;
    const run = () => {
      const y = window.scrollY;
      els.forEach((el) => {
        const speed = Number(el.dataset.parallax) || 0;
        const rot = Number(el.dataset.rotate) || 0;
        // a foto endireita conforme a página rola (rotação some em ~500px)
        const angle = rot * Math.max(0, 1 - y / 500);
        el.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg)`;
      });
      raf = null;
    };
    window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(run); }, { passive: true });
    run();
  }

  /* ---------- foto fixa que reage aos blocos (atendimento) ---------- */
  function initScrolly() {
    const sec = $(".scrolly");
    if (!sec) return;
    const steps = $$(".scrolly__step", sec);
    const caps = $$("[data-caption]", sec);
    const setActive = (i) => {
      sec.dataset.active = String(i);
      steps.forEach((s, j) => s.classList.toggle("is-active", j === i));
      caps.forEach((c, j) => { c.hidden = j !== i; });
    };
    setActive(0);
    if (!("IntersectionObserver" in window)) { steps.forEach((s) => s.classList.add("is-active")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(steps.indexOf(en.target)); });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    steps.forEach((s) => io.observe(s));
  }

  /* ---------- caderninho "como você está se sentindo hoje?" → WhatsApp ---------- */
  const feelMessage = (txt) => `Oi, Ernand. Hoje estou me sentindo ${txt.trim().replace(/[.!?]+$/, "")}. Pode me dar mais informações sobre o seu trabalho?`;

  function initFeel() {
    const form = $("#sentir");
    if (!form) return;
    const input = $("#sentir-texto");
    const preview = $("#sentir-previa");
    const err = $("#sentir-erro");
    const number = form.dataset.wa;

    const autosize = () => { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; };
    const update = () => {
      const v = input.value.trim();
      preview.textContent = v ? feelMessage(v) : "";
      preview.hidden = !v;
      if (v) err.hidden = true;
      autosize();
    };
    input.addEventListener("input", update);
    update();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (v.length < 3) {
        err.textContent = "Escreva pelo menos uma palavra sobre como você está.";
        err.hidden = false; input.focus();
        return;
      }
      const url = `https://wa.me/${number}?text=${encodeURIComponent(feelMessage(v))}`;
      const win = window.open(url, "_blank", "noopener");
      if (!win) location.href = url; // pop-up bloqueado: abre na mesma aba
    });
  }

  /* ---------- temas → começam a mensagem ---------- */
  function initTopics() {
    $$("[data-tema]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const t = topicBySlug(a.dataset.tema);
      prefillContact(a.dataset.feel || (t ? "com " + t.name.toLowerCase() : a.dataset.tema));
    }));
  }
  function prefillContact(texto) {
    const input = $("#sentir-texto");
    const contato = $("#contato");
    if (!contato) return;
    if (input && !input.value.trim()) { input.value = texto; input.dispatchEvent(new Event("input")); }
    smoothTo(contato);
    if (input) setTimeout(() => { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }, REDUCED ? 0 : 500);
  }

  /* ---------- validação de formulários ---------- */
  const MSG = {
    required: "Esse campo é obrigatório.",
    email: "Digite um e-mail válido, como nome@exemplo.com.",
    pattern: "Formato inválido.",
    minlength: "Muito curto.",
    consent: "Precisamos do seu consentimento para continuar."
  };
  function fieldWrap(input) { return input.closest(".field") || input.closest(".form__row") || input.parentElement; }
  function setError(input, msg) {
    const wrap = fieldWrap(input);
    let err = wrap.querySelector(".field__error");
    if (!err) { err = document.createElement("p"); err.className = "field__error"; wrap.appendChild(err); }
    if (msg) {
      err.textContent = msg; err.style.display = "block";
      wrap.classList.add("is-invalid"); input.setAttribute("aria-invalid", "true");
      if (!err.id) err.id = (input.id || "f" + Math.random().toString(36).slice(2)) + "-error";
      input.setAttribute("aria-describedby", err.id);
    } else {
      err.textContent = ""; err.style.display = "";
      wrap.classList.remove("is-invalid"); input.removeAttribute("aria-invalid");
    }
  }
  function validateInput(input) {
    const v = input.type === "checkbox" ? input.checked : input.value.trim();
    if (input.required && !v) return setError(input, input.type === "checkbox" ? MSG.consent : (input.dataset.msgRequired || MSG.required)), false;
    if (!v) return setError(input, ""), true;
    if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setError(input, MSG.email), false;
    if (input.minLength > 0 && String(v).length < input.minLength) return setError(input, input.dataset.msgMinlength || MSG.minlength), false;
    if (input.pattern && !new RegExp("^(?:" + input.pattern + ")$").test(v)) return setError(input, input.dataset.msgPattern || MSG.pattern), false;
    setError(input, "");
    return true;
  }
  function initForms() {
    $$("form[data-validate]").forEach((form) => {
      form.setAttribute("novalidate", "");
      const inputs = $$("input, textarea, select", form).filter((i) => i.type !== "submit" && i.type !== "hidden");
      inputs.forEach((i) => {
        i.addEventListener("input", () => { if (i.getAttribute("aria-invalid")) validateInput(i); });
        i.addEventListener("blur", () => { if (i.value || i.required) validateInput(i); });
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const bad = inputs.filter((i) => !validateInput(i));
        if (bad.length) { bad[0].focus(); return; }
        // Qualquer formulário com data-wa abre o WhatsApp do Ernand com os campos preenchidos.
        if (form.dataset.wa) {
          const linhas = inputs
            .filter((i) => i.type !== "checkbox" && i.value.trim())
            .map((i) => { const lab = form.querySelector(`label[for="${i.id}"]`); return (lab ? lab.textContent.trim() + ": " : "") + i.value.trim(); });
          const txt = "Oi, Ernand. " + linhas.join("\n");
          const url = `https://wa.me/${form.dataset.wa}?text=${encodeURIComponent(txt)}`;
          const win = window.open(url, "_blank", "noopener");
          if (!win) location.href = url;
          return;
        }
        const btn = form.querySelector('[type="submit"]');
        const label = btn ? btn.textContent : "";
        if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
        // Sem data-wa: simula o envio. Troque por fetch() para um backend, se um dia precisar.
        setTimeout(() => {
          form.classList.add("is-sent");
          if (btn) { btn.disabled = false; btn.textContent = label; }
          const ok = form.querySelector(".form__success");
          if (ok) { ok.setAttribute("tabindex", "-1"); ok.focus(); }
          form.reset();
        }, 700);
      });
    });
  }

  /* ---------- barra fixa de contato (celular) ---------- */
  function initStickyBar() {
    const bar = $("#stickybar");
    const contato = $("#contato");
    if (!bar) return;
    document.body.classList.add("has-stickybar");
    if (!contato || !("IntersectionObserver" in window)) return;
    new IntersectionObserver((entries) => {
      entries.forEach((en) => bar.classList.toggle("is-hidden", en.isIntersecting));
    }, { threshold: .15 }).observe(contato);
    const hero = $(".hero");
    if (hero) new IntersectionObserver((entries) => {
      entries.forEach((en) => bar.classList.toggle("is-early", en.isIntersecting));
    }, { threshold: .4 }).observe(hero);
  }

  /* ---------- página: artigos ---------- */
  function articleCard(a, i) {
    return `
      <a class="acard" href="notas.html?nota=${a.slug}" data-reveal>
        <div class="acard__media"><div class="polaroid${i % 2 ? " polaroid--r" : ""}"><span class="tape${i % 3 === 1 ? " tape--teal" : i % 3 === 2 ? " tape--plum" : ""}"></span><div class="ph ph--${a.tint}">${icon(a.icon)}</div></div></div>
        <div>
          <h3 class="t-md">${esc(a.title)}</h3>
          <p class="acard__meta"><span class="cat">${esc(a.cat)}</span><span>${fmtDate(a.date)}</span></p>
        </div>
      </a>`;
  }
  function initArticlesPage() {
    const grid = $("#artigos-grid");
    const bar = $("#categorias");
    const dlg = $("#leitura");
    if (!grid || !bar) return;

    const cats = ["Todos", ...new Set(DATA.articles.map((a) => a.cat))];
    let current = "Todos";
    bar.innerHTML = cats.map((c) => `<button type="button" aria-pressed="${c === current}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    const render = () => {
      const list = DATA.articles.filter((a) => current === "Todos" || a.cat === current);
      grid.innerHTML = list.map(articleCard).join("");
      $$("[data-reveal]", grid).forEach((el) => el.classList.add("in"));
      $$("button", bar).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === current)));
    };
    bar.addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (b) { current = b.dataset.cat; render(); } });
    render();

    if (!dlg) return;
    const body = $(".dialog__inner", dlg);
    let opener = null;
    const open = (a, trigger) => {
      opener = trigger || null;
      body.innerHTML = `
        <button class="dialog__close" type="button" data-close aria-label="Fechar">${icon("i-x")}</button>
        <p class="eyebrow">${esc(a.cat)}</p>
        <h2 class="t-lg" id="leitura-titulo" style="margin:14px 0 10px">${esc(a.title)}</h2>
        <p class="acard__meta" style="margin-bottom:22px"><span class="author">${esc(a.author)}</span><span>${fmtDate(a.date)}</span><span>${a.body.length} min de leitura</span></p>
        <div class="dialog__body">${a.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        <p class="small muted" style="margin-top:20px">Texto de caráter informativo. Não substitui atendimento.</p>
        <div class="dialog__actions"><a class="btn btn--primary" href="index.html#contato">Marcar uma conversa ${icon("i-arrow")}</a><button class="btn btn--ghost" type="button" data-close>Voltar às notas</button></div>`;
      dlg.showModal();
      const url = new URL(location.href); url.searchParams.set("nota", a.slug); replaceUrl(url);
    };
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".acard");
      if (!card) return;
      e.preventDefault();
      const slug = new URL(card.href).searchParams.get("nota");
      const a = DATA.articles.find((x) => x.slug === slug);
      if (a) open(a, card);
    });
    dlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => {
      if (opener) opener.focus();
      const url = new URL(location.href); url.searchParams.delete("nota"); replaceUrl(url);
    });
    const initial = DATA.articles.find((x) => x.slug === params.get("nota"));
    if (initial) open(initial);
  }

  /* ---------- rodapé: ano ---------- */
  function initFooter() { $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); }); }

  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initForms();
    initFeel();
    initTopics();
    initParallax();
    initScrolly();
    initStickyBar();
    initArticlesPage();
    initFooter();
    initReveal();
  });
})();