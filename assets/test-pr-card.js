/* =========================================================
  TPC Hotspot + TPC Select
  - Fix: always adding first variant
  - Fix: hidden variant id not updating correctly
  - Fix: reliable form targeting
========================================================= */

class TpcHotspot extends HTMLElement {
    constructor() {
        super();

        // Elements inside the hotspot component
        this.openBtn = this.querySelector("[data-tpc-open]");
        this.backdrop = this.querySelector(".tpcHotspot__backdrop");

        // Modal + form elements (outside this custom element)
        this.modal = null;
        this.form = null;

        // The hidden input that actually controls which variant is submitted
        this.variantInput = null;

        this.atcBtn = null;
        this.variants = null;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onAnyChange = this.onAnyChange.bind(this);
    }

    connectedCallback() {
        // Prevent double-binding if Shopify re-renders this block
        if (this.__tpcMounted) return;
        this.__tpcMounted = true;

        // Find modal using aria-controls
        const modalId = this.openBtn?.getAttribute("aria-controls");
        if (modalId) this.modal = document.getElementById(modalId);
        if (!this.modal) return;

        // Open/Close events
        this.openBtn?.addEventListener("click", () => this.open());
        this.backdrop?.addEventListener("click", () => this.close());

        // Close buttons
        this.modal.querySelectorAll("[data-tpc-close]").forEach((el) =>
            el.addEventListener("click", () => this.close())
        );
        this.querySelectorAll("[data-tpc-close]").forEach((el) =>
            el.addEventListener("click", () => this.close())
        );

        // Robust form lookup
        this.form =
            this.modal.querySelector("product-form form") ||
            this.modal.querySelector("form[action*='cart/add']") ||
            this.modal.querySelector("form");

        if (!this.form) return;

        // IMPORTANT FIX:
        // Always target the real hidden input inside THIS form
        this.variantInput =
            this.form.querySelector('input[name="id"]') ||
            this.form.querySelector("[data-tpc-variant-id]");

        this.atcBtn = this.form.querySelector("[type='submit']") || null;

        // Normalize action to relative /cart/add
        if (this.form) {
            let root = window.Shopify?.routes?.root || "/";

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

        // Load variants JSON
        const variantsEl = this.modal.querySelector("[data-tpc-variants]");
        this.variants = variantsEl ? JSON.parse(variantsEl.textContent) : null;

        // Listen for option changes
        this.modal.addEventListener("change", this.onAnyChange);

        // Initialize
        this.syncSwatchActive();
        this.updateVariantFromOptions();
    }

    onAnyChange(e) {
        // Accept any change inside an option control area
        const inOption =
            e.target.closest("select[data-tpc-option]") ||
            e.target.closest("[data-tpc-swatch-group]");

        if (!inOption) return;

        this.syncSwatchActive();
        this.updateVariantFromOptions();
    }


    open() {
        this.modal.hidden = false;
        if (this.backdrop) this.backdrop.hidden = false;

        this.openBtn?.setAttribute("aria-expanded", "true");
        document.addEventListener("keydown", this.onKeyDown);

        this.modal.querySelector("[data-tpc-close]")?.focus({ preventScroll: true });

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

        // Read selects
        this.modal.querySelectorAll("select[data-tpc-option]").forEach((sel) => {
            const idx = Number(sel.getAttribute("data-tpc-option-index") || "0");
            byIndex.set(idx, sel.value);
        });

        // Read swatches
        this.modal
            .querySelectorAll("[data-tpc-swatch-group][data-tpc-option]")
            .forEach((group) => {
                const idx = Number(group.getAttribute("data-tpc-option-index") || "0");
                const checked = group.querySelector("input[type='radio']:checked");
                if (checked) byIndex.set(idx, checked.value);
            });

        console.log(byIndex)

        return Array.from(byIndex.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v);
    }

    updateVariantFromOptions() {
        if (!this.variants || !this.variantInput) return;

        const selected = this.getSelectedOptionsInOrder();

        // If any option is still placeholder, keep ATC disabled and do nothing
        // if (selected.some((v) => !v)) {
        //     if (this.atcBtn) this.atcBtn.disabled = true;
        //     return;
        // }

        // Try to find exact matching variant
        const match = this.variants.find((v) =>
            selected.every((val, idx) => v.options[idx] === val)
        );

        // If no match, disable ATC
        // if (!match) {
        //     if (this.atcBtn) this.atcBtn.disabled = true;
        //     return;
        // }

        // THIS LINE FIXES THE "always first variant" issue
        // Update BOTH property + attribute (safe for all themes)
        this.variantInput.value = match.id;
        this.variantInput.setAttribute("value", match.id);

        // Fire events so anything listening can react
        this.variantInput.dispatchEvent(new Event("change", { bubbles: true }));
        this.variantInput.dispatchEvent(new Event("input", { bubbles: true }));


        // if (this.atcBtn) this.atcBtn.disabled = !match.available;
    }
}

customElements.define("tpc-hotspot", TpcHotspot);

/* =========================================================
  Custom animated select element
========================================================= */

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
        this.items.forEach((btn) =>
            btn.addEventListener("click", () => this.pick(btn))
        );

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

        if (value === "") {
            this.native.selectedIndex = 0;
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
            b.setAttribute(
                "aria-selected",
                b.getAttribute("data-value") === val ? "true" : "false"
            );
        });
    }
}

customElements.define("tpc-select", TpcSelect);
