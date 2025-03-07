import React from 'react';


const ExpectedAnnualFatalities = ({ 
  expectedAnnualFatalities
}) => {

  console.log("EXPECTED FATALITIES", expectedAnnualFatalities);
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <h3 style={{ margin: "0 0 10px 0" }}>
        Expected Annual Fatalities
      </h3>
      {expectedAnnualFatalities == null ? null : (
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>
          {expectedAnnualFatalities.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      )}
    </div>
  );
};

export default ExpectedAnnualFatalities;
