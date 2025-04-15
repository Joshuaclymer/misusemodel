import React from 'react';


const ExpectedAnnualFatalities = ({
  titleWord, 
  titleColor,
  expectedAnnualFatalities,
  baseline = null,
  width = "clamp(280px, 100%, 320px)",
  unacceptableRiskContribution = 30000
}) => {

  if (baseline === null) {
    return (
      <div style={{ 
          backgroundColor: "#FBFBFB",
          borderRadius: "8px",
          padding: "20px",
          boxSizing: "border-box",
          marginBottom: "clamp(5px, 2vw, 10px)",
          marginTop: "clamp(5px, 2vw, 10px)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
          width: width,
          textAlign: "center"
        }}>
        <h3 style={{ margin: "0", fontSize: "16px" }}>
          <span style={{ color: titleColor }}>{titleWord}</span> expected annual harm (e.g. lives lost):
        </h3>
        {expectedAnnualFatalities == null ? null : (
          <div style={{ fontSize: "16px", fontWeight: "bold", color: titleColor, marginTop: "6%" }}>
            {expectedAnnualFatalities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        )}
        </div>
    );
  } else {
      let string = "";
      console.log("risk line", baseline + unacceptableRiskContribution);
      console.log("expectedAnnualFatalities", expectedAnnualFatalities)
      console.log("baseline", (expectedAnnualFatalities <= baseline + unacceptableRiskContribution) && expectedAnnualFatalities >= baseline)
      if ((expectedAnnualFatalities <= baseline + unacceptableRiskContribution) && expectedAnnualFatalities >= baseline ) {
        string = "✅ (~= baseline)";
      } else if (expectedAnnualFatalities < baseline) {
        string = "✅ (< baseline)";
      } else {
        string = "⚠️ (unacceptable)";
      }
      return (<div style={{ 
          backgroundColor: "#FBFBFB",
          borderRadius: "8px",
          padding: "20px",
          boxSizing: "border-box",
          marginBottom: "clamp(5px, 2vw, 10px)",
          marginTop: "clamp(5px, 2vw, 10px)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
          width: width,
          textAlign: "center"
        }}>
        <h3 style={{ margin: "0", fontSize: "20px" }}>
          <span style={{ color: titleColor }}>{titleWord}</span> expected annual harm (e.g. lives lost):
        </h3>
        {expectedAnnualFatalities == null ? null : (
          <div style={{ fontSize: "20px", fontWeight: "bold",  marginTop: "8%" }}>
            <span style={{ color: titleColor }}>{expectedAnnualFatalities.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span style={{fontWeight: "normal"}}> {string}</span>
          </div>
        )}
        </div>
    );
  }
};
export default ExpectedAnnualFatalities;
