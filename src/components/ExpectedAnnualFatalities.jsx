import React from 'react';

const calculateExpectedFatalities = (successProbabilityGivenEffort, expectedAnnualAttempts, expectedFatalitiesPerSuccessfulAttempt) => {
  if (!successProbabilityGivenEffort || successProbabilityGivenEffort.length < 2) return 0;

  let expectation = 0;
  for (let i = 1; i < successProbabilityGivenEffort.length; i++) {
    const prevPoint = successProbabilityGivenEffort[i - 1];
    const currPoint = successProbabilityGivenEffort[i];
    
    const deltaCDF = currPoint.cumulativeProbability - prevPoint.cumulativeProbability;
    const successProb = currPoint.successProbability;
    
    expectation += deltaCDF * successProb * expectedAnnualAttempts * expectedFatalitiesPerSuccessfulAttempt * 1000000;
  }
  return expectation;
};

const ExpectedAnnualFatalities = ({ 
  successProbabilityGivenEffort,
  expectedAnnualAttempts,
  expectedFatalitiesPerSuccessfulAttempt
}) => {
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <h3 style={{ margin: "0 0 10px 0" }}>
        Expected Annual Fatalities
      </h3>
      <div style={{ fontSize: "24px", fontWeight: "bold" }}>
        {calculateExpectedFatalities(
          successProbabilityGivenEffort,
          expectedAnnualAttempts,
          expectedFatalitiesPerSuccessfulAttempt
        ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
};

export default ExpectedAnnualFatalities;
