/**
 * Attack path detail page: step nav, scroll spy, diagram ↔ breakdown sync.
 */

type CyNode = {
  length: number;
  addClass: (c: string) => void;
  connectedEdges: () => { removeClass: (c: string) => void };
};

type CyInstance = {
  getElementById: (id: string) => CyNode;
  nodes: () => { not: (n: CyNode) => { forEach: (fn: (n: CyNode) => void) => void } };
  edges: () => { addClass: (c: string) => void; removeClass: (c: string) => void };
  elements: () => { removeClass: (c: string) => void };
  animate: (opts: object, opts2?: object) => void;
};

function getCy(): CyInstance | null {
  const wrapper = document.querySelector<HTMLElement>('[data-cy-wrapper]');
  return (wrapper?.__cy as CyInstance | undefined) ?? null;
}

function setActiveNav(stepId: string) {
  document.querySelectorAll<HTMLButtonElement>('.step-jump-btn').forEach((btn) => {
    const active = btn.dataset.stepId === stepId;
    btn.classList.toggle('step-jump-btn-active', active);
    btn.setAttribute('aria-current', active ? 'step' : 'false');
  });
}

function setActiveBreakdown(stepId: string) {
  document.querySelectorAll('.step-breakdown-item').forEach((el) => {
    el.classList.toggle('step-breakdown-active', el.getAttribute('data-step-id') === stepId);
  });
}

function highlightDiagram(stepId: string, pan = true) {
  const cy = getCy();
  if (!cy) return;

  cy.elements().removeClass('active dimmed highlighted hover');
  cy.edges().removeClass('dimmed');

  const node = cy.getElementById(stepId);
  if (!node.length) return;

  node.addClass('active');
  cy.nodes().not(node).forEach((n) => n.addClass('dimmed'));
  cy.edges().addClass('dimmed');
  node.connectedEdges().removeClass('dimmed');

  if (pan) {
    cy.animate({ fit: { eles: node, padding: 80 } }, { duration: 280 });
  }
}

export function focusStep(stepId: string, options: { scroll?: boolean; pan?: boolean } = {}) {
  const { scroll = true, pan = true } = options;

  setActiveNav(stepId);
  setActiveBreakdown(stepId);
  highlightDiagram(stepId, pan);

  if (scroll) {
    const el = document.getElementById(`step-${stepId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function initAttackPathPage() {
  const page = document.querySelector('[data-attack-path-page]');
  if (!page) return;

  document.querySelectorAll<HTMLButtonElement>('.step-jump-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stepId = btn.dataset.stepId;
      if (stepId) focusStep(stepId, { scroll: true, pan: true });
    });
  });

  document.querySelectorAll('.step-breakdown-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, pre, code')) return;
      const stepId = item.getAttribute('data-step-id');
      if (stepId) focusStep(stepId, { scroll: false, pan: true });
    });
    item.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const stepId = item.getAttribute('data-step-id');
      if (stepId) focusStep(stepId, { scroll: false, pan: true });
    });
  });

  document.addEventListener('scrollToStep', ((e: CustomEvent<{ stepId: string }>) => {
    focusStep(e.detail.stepId, { scroll: true, pan: true });
  }) as EventListener);

  document.addEventListener('attackPathDiagramReady', () => {
    const active = document.querySelector<HTMLButtonElement>('.step-jump-btn-active');
    if (active?.dataset.stepId) highlightDiagram(active.dataset.stepId, false);
  });

  const steps = page.querySelectorAll('.step-breakdown-item');
  if (steps.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const stepId = visible[0].target.getAttribute('data-step-id');
        if (!stepId) return;
        setActiveNav(stepId);
        setActiveBreakdown(stepId);
        highlightDiagram(stepId, false);
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    steps.forEach((s) => observer.observe(s));
  }

  document.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, pre, code')) return;

    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.step-jump-btn')];
    const idx = buttons.findIndex((b) => b.classList.contains('step-jump-btn-active'));
    if (idx < 0) return;

    e.preventDefault();
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, buttons.length - 1) : Math.max(idx - 1, 0);
    const stepId = buttons[next]?.dataset.stepId;
    if (stepId) focusStep(stepId);
  });

}

declare global {
  interface HTMLElement {
    __cy?: unknown;
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAttackPathPage);
  } else {
    initAttackPathPage();
  }
}
