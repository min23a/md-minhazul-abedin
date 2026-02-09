class TpcHotspot extends HTMLElement {
    constructor() {
        super();

        this.openBtn = this.querySelector("[data-tpc-open]");
        this.backdrop = this.querySelector(".tpcHotspot__backdrop");
        this.closeEls = this.querySelectorAll("[data-tpc-close]");

        this.modal = null;
        this.modalCloseEls = [];

        // Variant handling (modal form lives OUTSIDE this element)
        this.form = null;
        this.variantInput = null;
        this.variantsEl = null;
        this.optionSelects = [];
        this.variants = null;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onBackdropClick = this.onBackdropClick.bind(this);
    }

    connectedCallback() {
        // Modal target via aria-controls (recommended)
        const modalId = this.openBtn?.getAttribute("aria-controls");
        if (modalId) {
            this.modal = document.getElementById(modalId);
        }

        // Fallback: look for the first matching modal in the DOM (by data-tpc-id)
        if (!this.modal) {
            const uid = this.getAttribute("data-tpc-id");
            if (uid) this.modal = document.getElementById(`tpcModal-${uid}`);
        }

        if (!this.modal) return; // can't work without modal

        // modal close buttons exist outside too
        this.modalCloseEls = this.modal.querySelectorAll("[data-tpc-close]");

        // Bind open/close
        this.openBtn?.addEventListener("click", () => this.open());
        this.closeEls.forEach((el) => el.addEventListener("click", () => this.close()));
        this.modalCloseEls.forEach((el) => el.addEventListener("click", () => this.close()));

        // Close on backdrop click
        this.backdrop?.addEventListener("click", this.onBackdropClick);

        // Setup variants (inside modal)
        this.form = this.modal.querySelector("form[action^='/cart/add'], form[action*='/cart/add']");
        this.variantInput = this.modal.querySelector("[data-tpc-variant-id]");
        this.variantsEl = this.modal.querySelector("[data-tpc-variants]");
        this.optionSelects = Array.from(this.modal.querySelectorAll("[data-tpc-option]"));
        this.variants = this.variantsEl ? JSON.parse(this.variantsEl.textContent) : null;

        if (this.variants && this.optionSelects.length) {
            this.optionSelects.forEach((sel) => sel.addEventListener("change", () => this.onOptionChange()));
            this.onOptionChange();
        }
    }

    onBackdropClick(e) {
        // Only if user clicked the actual backdrop
        if (e.target === this.backdrop) this.close();
    }

    open() {
        if (!this.modal) return;

        this.modal.hidden = false;
        if (this.backdrop) this.backdrop.hidden = false;

        this.openBtn?.setAttribute("aria-expanded", "true");
        document.addEventListener("keydown", this.onKeyDown);

        // Focus close button for accessibility
        const closeBtn = this.modal.querySelector("[data-tpc-close]");
        closeBtn?.focus({ preventScroll: true });

        // Optional scroll lock
        document.documentElement.classList.add("tpc--lock");
    }

    close() {
        if (!this.modal) return;

        this.modal.hidden = true;
        if (this.backdrop) this.backdrop.hidden = true;

        this.openBtn?.setAttribute("aria-expanded", "false");
        document.removeEventListener("keydown", this.onKeyDown);

        this.openBtn?.focus({ preventScroll: true });

        document.documentElement.classList.remove("tpc--lock");
    }

    onKeyDown(e) {
        if (e.key === "Escape") this.close();
    }

    onOptionChange() {
        if (!this.variants || !this.variantInput) return;

        const selected = this.optionSelects.map((s) => s.value);

        const match = this.variants.find((v) =>
            selected.every((val, idx) => v.options[idx] === val)
        );

        if (match) {
            this.variantInput.value = match.id;

            const atc = this.form?.querySelector("[type='submit']");
            if (atc) atc.disabled = !match.available;
        }
    }
}

customElements.define("tpc-hotspot", TpcHotspot);
