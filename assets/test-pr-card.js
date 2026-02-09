class TpcHotspot extends HTMLElement {
    constructor() {
        super();
        this.openBtn = this.querySelector("[data-tpc-open]");
        this.backdrop = this.querySelector(".tpcHotspot__backdrop");

        this.modal = null;
        this.form = null;
        this.variantInput = null;
        this.atcBtn = null;
        this.variants = null;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onAnyChange = this.onAnyChange.bind(this);
    }

    connectedCallback() {
        // Prevent double-binding if Shopify re-renders
        if (this.__tpcMounted) return;
        this.__tpcMounted = true;

        const modalId = this.openBtn?.getAttribute("aria-controls");
        if (modalId) this.modal = document.getElementById(modalId);
        if (!this.modal) return;

        // Open/Close
        this.openBtn?.addEventListener("click", () => this.open());
        this.backdrop?.addEventListener("click", () => this.close());

        // Close buttons inside modal + inside hotspot
        this.modal.querySelectorAll("[data-tpc-close]").forEach((el) => el.addEventListener("click", () => this.close()));
        this.querySelectorAll("[data-tpc-close]").forEach((el) => el.addEventListener("click", () => this.close()));

        // ✅ Robust form lookup (works even if action is absolute or changes)
        this.form =
            this.modal.querySelector("product-form form") ||
            this.modal.querySelector("form[action*='cart/add']") ||
            this.modal.querySelector("form");

        this.variantInput = this.modal.querySelector("[data-tpc-variant-id]");
        this.atcBtn = this.form?.querySelector("[type='submit']") || null;

        // ✅ Force SAME-ORIGIN (RELATIVE) /cart/add to avoid CORS + "/encart/add" bug
        if (this.form) {
            let root = window.Shopify?.routes?.root || "/";

            // absolute -> pathname
            if (typeof root === "string" && (root.startsWith("http://") || root.startsWith("https://"))) {
                try {
                    root = new URL(root).pathname;
                } catch {
                    root = "/";
                }
            }

            if (!root.startsWith("/")) root = `/${root}`;
            if (!root.endsWith("/")) root = `${root}/`;

            this.form.setAttribute("action", `${root}cart/add`);
        }

        const variantsEl = this.modal.querySelector("[data-tpc-variants]");
        this.variants = variantsEl ? JSON.parse(variantsEl.textContent) : null;

        // Listen changes (selects + radio swatches)
        this.modal.addEventListener("change", this.onAnyChange);

        // Init state
        this.syncSwatchActive();
        this.updateVariantFromOptions();
    }

    onAnyChange(e) {
        const isSelect = e.target.matches("select[data-tpc-option]");
        const isSwatchRadio = e.target.matches("input.tpcSwatches__input");
        if (!isSelect && !isSwatchRadio) return;

        this.syncSwatchActive();
        this.updateVariantFromOptions();
    }

    open() {
        this.modal.hidden = false;
        if (this.backdrop) this.backdrop.hidden = false;
        this.openBtn?.setAttribute("aria-expanded", "true");
        document.addEventListener("keydown", this.onKeyDown);
        this.modal.querySelector("[data-tpc-close]")?.focus({ preventScroll: true });

        // Ensure state correct when opening
        this.syncSwatchActive();
        this.updateVariantFromOptions();
    }

    close() {
        this.modal.hidden = true;
        if (this.backdrop) this.backdrop.hidden = true;
        this.openBtn?.setAttribute("aria-expanded", "false");
        document.removeEventListener("keydown", this.onKeyDown);
        this.openBtn?.focus({ preventScroll: true });
    }

    onKeyDown(e) {
        if (e.key === "Escape") this.close();
    }

    syncSwatchActive() {
        const groups = this.modal.querySelectorAll("[data-tpc-swatch-group]");
        groups.forEach((group) => {
            const inputs = Array.from(group.querySelectorAll(".tpcSwatches__input"));
            const idx = Math.max(0, inputs.findIndex((i) => i.checked));
            group.style.setProperty("--tpc-active", String(idx));
            group.style.setProperty("--tpc-count", String(inputs.length || 1));
        });
    }

    getSelectedOptionsInOrder() {
        const byIndex = new Map();

        // Select dropdowns
        this.modal.querySelectorAll("select[data-tpc-option]").forEach((sel) => {
            const idx = Number(sel.getAttribute("data-tpc-option-index") || "0");
            byIndex.set(idx, sel.value);
        });

        // Swatch groups
        this.modal.querySelectorAll("[data-tpc-swatch-group][data-tpc-option]").forEach((group) => {
            const idx = Number(group.getAttribute("data-tpc-option-index") || "0");
            const checked = group.querySelector(".tpcSwatches__input:checked");
            if (checked) byIndex.set(idx, checked.value);
        });

        return Array.from(byIndex.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v);
    }

    updateVariantFromOptions() {
        if (!this.variants || !this.variantInput) return;

        const selected = this.getSelectedOptionsInOrder();

        // Exact match only if all options selected (no "")
        let match = null;
        if (!selected.some((v) => !v)) {
            match = this.variants.find((v) => selected.every((val, idx) => v.options[idx] === val));
        }

        // Fallback: first available variant so ATC can submit
        if (!match) {
            match = this.variants.find((v) => v.available) || this.variants[0];
        }

        if (!match) return;

        this.variantInput.value = match.id;

        if (this.atcBtn) this.atcBtn.disabled = !match.available;
    }
}

customElements.define("tpc-hotspot", TpcHotspot);

class TpcSelect extends HTMLElement {
    constructor() {
        super();
        this.native = this.querySelector("select");
        this.trigger = this.querySelector(".tpcSelect__trigger");
        this.valueEl = this.querySelector(".tpcSelect__value");
        this.panel = this.querySelector(".tpcSelect__panel");
        this.items = Array.from(this.querySelectorAll("[data-tpc-select-item]"));

        this._closingTimer = null;
        this.onDocClick = this.onDocClick.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    connectedCallback() {
        if (!this.native || !this.trigger || !this.panel) return;

        this.setAttribute("data-open", "false");
        this.panel.hidden = true;

        this.syncFromNative();

        this.trigger.addEventListener("click", () => this.toggle());
        this.items.forEach((btn) => btn.addEventListener("click", () => this.pick(btn)));

        document.addEventListener("click", this.onDocClick);
        this.addEventListener("keydown", this.onKeyDown);

        this.native.addEventListener("change", () => this.syncFromNative());
    }

    disconnectedCallback() {
        document.removeEventListener("click", this.onDocClick);
    }

    onDocClick(e) {
        if (!this.hasAttribute("data-open")) return;
        if (!this.contains(e.target)) this.close();
    }

    onKeyDown(e) {
        if (e.key === "Escape") this.close();
    }

    toggle() {
        this.getAttribute("data-open") === "true" ? this.close() : this.open();
    }

    open() {
        clearTimeout(this._closingTimer);
        this.setAttribute("data-open", "true");
        this.trigger.setAttribute("aria-expanded", "true");
        this.panel.hidden = false;
    }

    close() {
        if (this.getAttribute("data-open") !== "true") return;

        this.setAttribute("data-open", "false");
        this.trigger.setAttribute("aria-expanded", "false");

        clearTimeout(this._closingTimer);
        this._closingTimer = setTimeout(() => {
            if (this.getAttribute("data-open") === "false") this.panel.hidden = true;
        }, 180);
    }

    pick(btn) {
        const value = btn.getAttribute("data-value");
        if (value === null) return;

        // ✅ SINGLE update + SINGLE change event (your old file dispatched twice)
        if (value === "") {
            this.native.selectedIndex = 0; // placeholder
        } else {
            this.native.value = value;
        }

        this.native.dispatchEvent(new Event("change", { bubbles: true }));
        this.syncFromNative();
        this.close();
    }

    syncFromNative() {
        const idx = this.native?.selectedIndex ?? -1;
        const label = idx >= 0 ? this.native.options[idx].textContent : "";

        if (this.valueEl) this.valueEl.textContent = (label || "").trim();

        const val = this.native?.value ?? "";
        this.items.forEach((b) => {
            b.setAttribute("aria-selected", b.getAttribute("data-value") === val ? "true" : "false");
        });
    }
}

customElements.define("tpc-select", TpcSelect);
