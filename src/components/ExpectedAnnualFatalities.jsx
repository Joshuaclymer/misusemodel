import React from 'react';


const ExpectedAnnualFatalities = ({
  titleWord, 
  titleColor,
  expectedAnnualFatalities
}) => {

  return (
    <div style={{ 
        backgroundColor: "#FBFBFB",
        borderRadius: "8px",
        padding: "20px",
        margin: "clamp(5px, 2vw, 10px)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
        width: "clamp(280px, 100%, 320px)",
        textAlign: "center"
      }}>
      <h3 style={{ margin: "0", fontSize: "16px" }}>
        <span style={{ color: titleColor }}>{titleWord}</span> expected annual fatalities:
      </h3>
      {expectedAnnualFatalities == null ? null : (
        <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "6%" }}>
          {expectedAnnualFatalities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      )}
      </div>
  );
};

export default ExpectedAnnualFatalities;
