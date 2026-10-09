import React from "react";
import { useInboxKeywords } from "../InboxContext";

const KeywordsSection = ({ maxHeightClass = "max-h-96" }) => {
  const {
    keywords,
    keywordCounts,
    activeKeywordIds,
    toggleKeyword,
  } = useInboxKeywords();

  const visibleKeywords = keywords.filter(
    (keyword) => (keywordCounts[String(keyword.id)] || 0) > 0,
  );

  return (
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
          {visibleKeywords.map((keyword) => {
            const id = String(keyword.id);
            const count = keywordCounts[id] || 0;

            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleKeyword(id)}
                className={`pill pillInteractive${activeKeywordIds.has(id) ? " pillActive" : ""}`}
                title={`${keyword.match_type}${keyword.case_sensitive ? ", case-sensitive" : ""}`}
              >
                <span>{keyword.pattern}</span>
                <span className="pillCount">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KeywordsSection;
