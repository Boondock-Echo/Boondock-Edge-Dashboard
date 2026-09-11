import React from "react";

const KeywordsSection = ({
  keywordCounts,
  activeKeywords,
  handleKeywordClick,
  maxHeightClass = "max-h-96",
}) => (
  <div style={{ height: "100%" }}>
    <div
      className={maxHeightClass !== "max-h-96" ? maxHeightClass : undefined}
      style={{
        height: "100%",
        overflowY: "auto",
        maxHeight: maxHeightClass === "max-h-96" ? "24rem" : undefined,
      }}
    >
      <div className="rowWrap">
        {Object.entries(keywordCounts).map(([keyword, count]) => (
          <button
            key={keyword}
            type="button"
            onClick={() => handleKeywordClick(keyword)}
            className={`pill pillInteractive${activeKeywords.has(keyword) ? " pillActive" : ""}`}
          >
            <span>{keyword}</span>
            <span className="pillCount">{count}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default KeywordsSection;
