const sampleText = `I drafted the opening paragraph by hand to preserve the factual framing.

The model then proposed three concise alternatives for the middle section.

I revised the selected model draft for tone, removed an unsupported claim, and added the final sentence myself.`;

const mockSignResponse = {
  signed_text: `${sampleText}

[[LPS_MANIFEST:demo-survival-test-v1:eyJtYW5pZmVzdCI6Im1vY2stb25seSJ9]]`,
};

const mockVerifyResponse = {
  status: "verified",
  reason_string: "signature_intact_manifest_survived_round_trip",
  headline: "Verified - this text's provenance signature is intact",
  explanation: "The pasted text still matches the embedded provenance manifest returned by the demo signer.",
  proportions: {
    human: 46,
    ai_generated: 34,
    ai_modified_human: 20,
  },
  segments: [
    {
      segment_id: "seg-001",
      origin: "human",
      start_offset: 0,
      end_offset: 75,
      confidence: 0.98,
      confidence_source: "manifest_signature",
      ai_tool: "none",
    },
    {
      segment_id: "seg-002",
      origin: "ai_generated",
      start_offset: 77,
      end_offset: 145,
      confidence: 0.96,
      confidence_source: "manifest_signature",
      ai_tool: "demo-model",
    },
    {
      segment_id: "seg-003",
      origin: "ai_modified_human",
      start_offset: 147,
      end_offset: 248,
      confidence: 0.94,
      confidence_source: "manifest_signature",
      ai_tool: "demo-model",
      modification_degree: "moderate",
    },
  ],
  embedding_method_used: "A.8",
  algorithm: "LPS-DEMO-Ed25519",
  signed_at: "2026-07-05T12:00:00Z",
  compressed_manifest_byte_sizes: {
    canonical_manifest: 812,
    compressed_manifest: 354,
    embedded_payload: 488,
  },
  disclosure_threshold_outcome: "passed",
  cert_fingerprint: "SHA256:9A:3C:72:4F:B9:18:CD:0E:67:44:21:AB:E5:30:91:7D",
  cert_url: "https://example.invalid/lps/demo-cert.pem",
};

const signInput = document.querySelector("#sign-input");
const signedOutput = document.querySelector("#signed-output");
const verifyInput = document.querySelector("#verify-input");
const signButton = document.querySelector("#sign-button");
const verifyButton = document.querySelector("#verify-button");
const copyButton = document.querySelector("#copy-button");
const copyLabel = document.querySelector("#copy-label");
const copyStatus = document.querySelector("#copy-status");
const reportPanel = document.querySelector("#report-panel");
const resultHeadline = document.querySelector("#result-headline");
const resultExplanation = document.querySelector("#result-explanation");
const proportionReadout = document.querySelector("#proportion-readout");
const technicalList = document.querySelector("#technical-list");
const segmentTableBody = document.querySelector("#segment-table-body");
const tabs = Array.from(document.querySelectorAll(".report-tab"));
const panels = Array.from(document.querySelectorAll("[role='tabpanel']"));

let copyTimerId = 0;

function setText(element, value) {
  element.textContent = String(value);
}

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function createValueSpan(value) {
  const span = document.createElement("span");
  span.className = "data-value";
  setText(span, value);
  return span;
}

function signText() {
  signedOutput.value = mockSignResponse.signed_text;
  verifyInput.value = mockSignResponse.signed_text;
}

function setCopyState(isCopied) {
  copyButton.classList.toggle("copy-button--copied", isCopied);
  setText(copyLabel, isCopied ? "Copied" : "Copy");
  setText(copyStatus, isCopied ? "Copied" : "");
}

async function copySignedOutput() {
  if (!signedOutput.value) {
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(signedOutput.value);
  } else {
    signedOutput.focus();
    signedOutput.select();
    document.execCommand("copy");
  }

  window.clearTimeout(copyTimerId);
  setCopyState(true);
  copyTimerId = window.setTimeout(() => setCopyState(false), 2000);
}

function renderProportions(proportions) {
  clearChildren(proportionReadout);

  Object.entries(proportions).forEach(([origin, percent]) => {
    const item = document.createElement("div");
    item.className = "proportion-readout__item";

    const label = document.createElement("span");
    label.className = "proportion-readout__label";
    setText(label, origin);

    const value = document.createElement("span");
    value.className = "proportion-readout__value";
    setText(value, `${percent}%`);

    item.append(label, value);
    proportionReadout.append(item);
  });
}

function addTechnicalRow(labelText, value) {
  const term = document.createElement("dt");
  term.className = "technical-list__term";
  setText(term, labelText);

  const description = document.createElement("dd");
  description.className = "technical-list__description";
  description.append(createValueSpan(value));

  technicalList.append(term, description);
}

function renderTechnicalDetails(report) {
  clearChildren(technicalList);
  clearChildren(segmentTableBody);

  addTechnicalRow("status", report.status);
  addTechnicalRow("reason_string", report.reason_string);
  addTechnicalRow("embedding_method_used", report.embedding_method_used);
  addTechnicalRow("algorithm", report.algorithm);
  addTechnicalRow("signed_at", report.signed_at);

  Object.entries(report.compressed_manifest_byte_sizes).forEach(([stage, bytes]) => {
    addTechnicalRow(`compressed manifest byte size - ${stage}`, `${bytes} bytes`);
  });

  addTechnicalRow("disclosure-threshold outcome", report.disclosure_threshold_outcome);
  addTechnicalRow("cert_fingerprint", report.cert_fingerprint);
  addTechnicalRow("cert_url", report.cert_url);

  report.segments.forEach((segment) => {
    const row = document.createElement("tr");
    row.className = "segment-table__row";

    [
      segment.segment_id,
      segment.origin,
      segment.start_offset,
      segment.end_offset,
      segment.confidence,
      segment.confidence_source,
      segment.ai_tool,
      segment.origin === "ai_modified_human" ? segment.modification_degree : "",
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.className = "segment-table__cell";
      cell.append(createValueSpan(value));
      row.append(cell);
    });

    segmentTableBody.append(row);
  });
}

function renderReport(report) {
  setText(resultHeadline, report.headline);
  setText(resultExplanation, report.explanation);
  renderProportions(report.proportions);
  renderTechnicalDetails(report);
  reportPanel.classList.remove("report-panel--hidden");
}

function selectTab(tab) {
  tabs.forEach((currentTab) => {
    const isSelected = currentTab === tab;
    currentTab.classList.toggle("report-tab--active", isSelected);
    currentTab.setAttribute("aria-selected", String(isSelected));
    currentTab.tabIndex = isSelected ? 0 : -1;
  });

  panels.forEach((panel) => {
    const isSelected = panel.id === tab.getAttribute("aria-controls");
    panel.hidden = !isSelected;
    panel.classList.toggle("technical-report--hidden", !isSelected && panel.id === "technical-panel");
  });
}

function moveTabFocus(currentIndex, direction) {
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  tabs[nextIndex].focus();
  selectTab(tabs[nextIndex]);
}

signButton.addEventListener("click", signText);
verifyButton.addEventListener("click", () => renderReport(mockVerifyResponse));
copyButton.addEventListener("click", copySignedOutput);

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTabFocus(index, 1);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTabFocus(index, -1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      tabs[0].focus();
      selectTab(tabs[0]);
    }

    if (event.key === "End") {
      event.preventDefault();
      tabs[tabs.length - 1].focus();
      selectTab(tabs[tabs.length - 1]);
    }
  });
});

signInput.value = sampleText;
signText();
