import { fitQueriesCurve } from "../components/QueriesVsTime.jsx";
import { maxTimeMonths } from "../App.js";
import { generateCDFData } from "../components/EffortCDF.jsx";

// Calculate expected annual fatalities based on success probability and other factors

const findNearestPointBinarySearch = (arr, targetTime, timeKey = "time") => {
  // Edge cases
  for (let i = 0; i < arr.length; i++) {
    arr[i].index = i;
  }
  if (arr.length === 0) return null;
  if (arr[arr.length - 1][timeKey] < targetTime) return arr[arr.length - 1]; // Return last point if target is beyond all points
  if (arr[0][timeKey] >= targetTime) return arr[0]; // Return first point if target is before all points
  
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    // Found exact match
    if (arr[mid][timeKey] === targetTime) {
      return arr[mid];
    }
    
    // Target is in right half
    if (arr[mid][timeKey] < targetTime) {
      left = mid + 1;
    } 
    // Target is in left half
    else {
      right = mid - 1;
    }
  }
  
  // At this point, left > right
  // left is the index of the first element >= target
  return arr[left];
};

export const calculateSuccessDistribution = (successProbabilityGivenEffort, effortCDF) => {
  // First normalize successProbabilityGivenEffort to bins

  const successDistribution = [];
  for (let i = 1; i < effortCDF.length; i++) {
    const timeThisStep = effortCDF[i].months;
    const probabilityOfTime = (effortCDF[i].cumulativeProbability - effortCDF[i - 1].cumulativeProbability);
    const successProbabilityDuringTime = findNearestPointBinarySearch(successProbabilityGivenEffort, timeThisStep).successProbability * probabilityOfTime;
    successDistribution.push({
      time: timeThisStep,
      successProbability: successProbabilityDuringTime
    });
  }

  return successDistribution;
};

export const calculateExpectedAnnualFatalities = (
  successProbabilityGivenEffort,
  expectedAnnualAttempts,
  expectedFatalitiesPerSuccessfulAttempt,
  effortCDF
) => {


  // Calculate the expected number of successful attempts
  var sumOfSuccessProbabilities = 0;
  var sumOfTimeProbabilities = 0;
  for (let i = 1; i < effortCDF.length; i++) {
    const timeThisStep = effortCDF[i].months
    const nearestSuccessProbabilityPoint = successProbabilityGivenEffort.find(p => p.time >= timeThisStep) || successProbabilityGivenEffort[successProbabilityGivenEffort.length - 1];
    if (!nearestSuccessProbabilityPoint) {
      continue;
    }
    const probabilityOfTime = (effortCDF[i].cumulativeProbability - effortCDF[i - 1].cumulativeProbability);
    sumOfSuccessProbabilities += nearestSuccessProbabilityPoint.successProbability * probabilityOfTime;
    sumOfTimeProbabilities += probabilityOfTime;
  }
  const expectedSuccess = sumOfSuccessProbabilities;
  const expectedAnnualFatalities = expectedSuccess * expectedAnnualAttempts * expectedFatalitiesPerSuccessfulAttempt;

  // Calculate total expected fatalities
  return expectedAnnualFatalities;
};

export const calculateTimeToExecuteQueriesGivenBans = ({
  bansGivenQueries,
  timeLostGivenBans,
  timeToExecuteQueries,
}) => {
  let timeToExecuteQueriesGivenBans = [];

  // Collect points with adaptive sampling
  let lastValidIndex = 0;
  let lastAddedTime = -1;
  const minTimeGap = 5; // Minimum gap between points to reduce density

  for (let i = 0; i <= 1000; i++) {
    const numBans = Math.floor(bansGivenQueries[i]);
    const totalTimeLostDueToBans = timeLostGivenBans[numBans];
    const execTime = timeToExecuteQueries[i] || 0;
    const time = execTime + totalTimeLostDueToBans;
    timeToExecuteQueriesGivenBans.push({
      time: time,
      queries: i,
    });
  }

  return timeToExecuteQueriesGivenBans;
};

// Helper function to interpolate values from an array of objects
const arrayToFunction = (array, inputKey, outputKey, inputValue) => {
  // Find the index of the first point that is greater than our input value
  const index = array.findIndex((point) => point[inputKey] > inputValue);

  if (index === -1) return array[array.length - 1][outputKey]; // Value is after last point
  if (index === 0) return array[0][outputKey]; // Value is before first point

  // Interpolate between the two points
  const point1 = array[index - 1];
  const point2 = array[index];
  const ratio =
    (inputValue - point1[inputKey]) / (point2[inputKey] - point1[inputKey]);
  return point1[outputKey] + ratio * (point2[outputKey] - point1[outputKey]);
};

export const getTimeToExecuteQueries = (points, startQueries, endQueries) => {
  const startTime = fitQueriesCurve(startQueries, points);
  const endTime = fitQueriesCurve(endQueries, points);
  return endTime - startTime;
};

export const getPostMitigationSuccessProbabilityGivenEffort = (
  queriesAttackerExecutesPerMonth,
  timeToExecuteQueries,
  preMitigationSuccessProbability,
  bansVsQueries,
  timeLostGivenBans
) => {
  // First calculate all points
  const timeToExecuteQueriesGivenBans = calculateTimeToExecuteQueriesGivenBans({
    bansGivenQueries: bansVsQueries,
    timeLostGivenBans,
    timeToExecuteQueries,
  }); // Convert days to months

  const points = [];
  for (
    let queries = 0;
    queries < timeToExecuteQueriesGivenBans.length;
    queries++
  ) {
    const timeBetweenQueries = 1 / queriesAttackerExecutesPerMonth;
    const timeIfUnmitigated = queries * timeBetweenQueries;

    // Find the matching query point
    const queryPoint = timeToExecuteQueriesGivenBans.find(
      (point) => point.queries === queries
    );
    if (!queryPoint) {
      continue;
    }
    const timeSpentJailbreaking = queryPoint.time / 30;
    const totalTime = timeIfUnmitigated + timeSpentJailbreaking;

    const successProbability = arrayToFunction(
      preMitigationSuccessProbability,
      "time",
      "successProbability",
      timeIfUnmitigated
    );


    if (totalTime < 0.1) continue;
    else
      points.push({
        time: totalTime,
        successProbability: successProbability,
      });
  }

  // Filter out points with zero time, truncate at maxTimeMonths, and sort by time
  const validPoints = points
    .filter((p) => p.time >= 0.1 && p.time <= maxTimeMonths)
    .sort((a, b) => a.time - b.time)
    // Convert to expected format
    .map((p) => ({
      time: p.time,
      successProbability: p.successProbability,
    }));

  return validPoints;
};

export const runModel = (params) => {
  const postMitigationSuccessProbabilityGivenEffort =
    getPostMitigationSuccessProbabilityGivenEffort(
      params.queriesAttackerExecutesPerMonth,
      params.timeToExecuteQueries,
      params.preMitigationSuccessProbabilityGivenEffort,
      params.bansVsQueries,
      params.timeLostToBans
    );
  const baselineExpectedAnnualFatalities = calculateExpectedAnnualFatalities(
    params.baselineSuccessProbabilityGivenEffort,
    params.expectedAnnualAttempts,
    params.expectedFatalitiesPerSuccessfulAttempt,
    params.effortCDF
  );

  const preMitigationExpectedAnnualFatalities =
    calculateExpectedAnnualFatalities(
      params.preMitigationSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt,
      params.effortCDF
    );
  

  const postMitigationExpectedAnnualFatalities =
    calculateExpectedAnnualFatalities(
      postMitigationSuccessProbabilityGivenEffort,
      params.expectedAnnualAttempts,
      params.expectedFatalitiesPerSuccessfulAttempt,
      params.effortCDF
    );
  
  const simulationResults = simulateDeployment(params);
  const mainlineRiskProjection = simulationResults.mainlineRiskProjection;
  const riskProjectionWithJailbreak = simulationResults.riskProjectionWithJailbreak;

  return {
    postMitigationSuccessProbabilityGivenEffort,
    baselineExpectedAnnualFatalities,
    preMitigationExpectedAnnualFatalities,
    postMitigationExpectedAnnualFatalities,
    mainlineRiskProjection,
    riskProjectionWithJailbreak
  };
};


// Apply Gaussian smoothing to a risk projection array without normalization
const applyGaussianSmoothing = (projection, sigma = 3) => {
  if (!projection || projection.length === 0) return;
  
  // Store original values
  const originalValues = projection.map(p => p.risk);
  
  // Calculate kernel size to cover ±3σ
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1; // Ensure odd number
  
  const smoothedValues = new Array(projection.length).fill(0);
  
  // Create Gaussian kernel
  const kernel = [];
  let kernelSum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - Math.floor(kernelSize / 2);
    const weight = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(weight);
    kernelSum += weight;
  }
  
  // Normalize kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= kernelSum;
  }
  
  // Special handling for the beginning of the curve
  // Mirror the first few points to create a more natural start
  const mirroredValues = [...originalValues];
  const mirrorSize = Math.floor(kernelSize / 2);
  
  // Create mirrored points at the beginning
  for (let i = 0; i < mirrorSize; i++) {
    // Use a gradual approach to zero for mirrored points
    const factor = (mirrorSize - i) / mirrorSize;
    mirroredValues.unshift(originalValues[0] * factor);
  }
  
  // Apply convolution with mirrored values for better edge handling
  for (let i = 0; i < projection.length; i++) {
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let j = 0; j < kernelSize; j++) {
      const mirroredIdx = i + j + mirrorSize - Math.floor(kernelSize / 2);
      if (mirroredIdx >= 0 && mirroredIdx < mirroredValues.length) {
        weightedSum += mirroredValues[mirroredIdx] * kernel[j];
        weightSum += kernel[j];
      }
    }
    
    smoothedValues[i] = weightSum > 0 ? weightedSum / weightSum : originalValues[i];
  }
  
  // Apply smoothed values directly without normalization
  for (let i = 0; i < projection.length; i++) {
    projection[i].risk = smoothedValues[i];
  }
};

const alignSuccessProbabilitiesWithTimePoints = (successProbabilities, timePoints, effortCDFNormalized, effortCDF) => {

  const alignedSuccessProbabilities = timePoints.map(p => ({
    time: p.time,
    successProbability: findNearestPointBinarySearch(successProbabilities, p.time).successProbability
  }));


  // get the pre-normalized post mitigation success distribution
  const successDistribution  = calculateSuccessDistribution(successProbabilities, effortCDF);
  console.log("successDistribution", successDistribution)

  // get the total area under the success distribution
  const preNormalizedArea = successDistribution.reduce((acc, p) => acc + p.successProbability, 0);

  // get the normalized post mitigation success distribution
  const normalizedSuccessDistribution = calculateSuccessDistribution(alignedSuccessProbabilities, effortCDFNormalized, timePoints);

  // get total area under the normalized success distribution
  const normalizedArea = normalizedSuccessDistribution.reduce((acc, p) => acc + p.successProbability, 0);

  // renormalize so that the normalized distribution has the same area under the curve
  const renormalizationFactor = preNormalizedArea / normalizedArea;
  let result = alignedSuccessProbabilities.map(p => ({
    time: p.time,
    successProbability: p.successProbability * renormalizationFactor
  }));

  // add index
  for (let i = 0; i < result.length; i++) {
    result[i].index = i;
  }
  return result;
  
}
const simulateDeployment = (params) => {
  const postMitigationSuccessProbability = getPostMitigationSuccessProbabilityGivenEffort(
    params.queriesAttackerExecutesPerMonth,
    params.timeToExecuteQueries,
    params.preMitigationSuccessProbabilityGivenEffort,
    params.bansVsQueries,
    params.timeLostToBans
  );

  // Simulate normal deployment
  const lengthOfDeployment = 120;
  const numberOfSimulations = 100;

  const simulationResults = {
    mainlineRiskProjection: [],
    riskProjectionWithJailbreak: []
  };
  // console.log("successDistributions", successDistributions)
  // calculate annualized risk for each period of time
  const numTimePoints = 100;
  const timePoints = Array.from({ length: numTimePoints + 1}, (_, i) => (i) * (lengthOfDeployment / numTimePoints));
  console.log("timePoints", timePoints);
  const timePointsObjects = timePoints.map((p, i) => ({
    time: p,
    index: i
  }));

  // Normalize effortCDF
  console.log("effortCDF", params.effortCDF)
  const effortCDFNormalized = timePointsObjects.map(p => ({
    months: p.time,
    cumulativeProbability: p.time > params.effortCDF[params.effortCDF.length - 1].time ? 1 : findNearestPointBinarySearch(params.effortCDF, p.time, "months").cumulativeProbability
  }));

  // assert that effortCDFNormalized is monotonically increasing
  for (let i = 1; i < effortCDFNormalized.length; i++) {
    if (effortCDFNormalized[i].cumulativeProbability < effortCDFNormalized[i - 1].cumulativeProbability) {
      throw new Error('effortCDFNormalized is not monotonically increasing');
    }
  }

  // assert that effortCDFNormalized starts at 0 and ends at 1
  if (effortCDFNormalized[0].cumulativeProbability !== 0) {
    console.error('effortCDFNormalized does not start at 0', effortCDFNormalized);
    // throw new Error('effortCDFNormalized does not start at 0');
  }
  if (effortCDFNormalized[effortCDFNormalized.length - 1].cumulativeProbability !== 1) {
    console.error('effortCDFNormalized does not end at 1', effortCDFNormalized);
    // throw new Error('effortCDFNormalized does not end at 1', effortCDFNormalized);
  }


  // Get aligned post mitigation and pre mitigation success probabilities
  console.log("postMitigationSuccessProbability", postMitigationSuccessProbability);
  
  const alignedPostMitigationSuccessProbabilities = alignSuccessProbabilitiesWithTimePoints(postMitigationSuccessProbability, timePointsObjects, effortCDFNormalized, params.effortCDF);
  const alignedPreMitigationSuccessProbabilities = alignSuccessProbabilitiesWithTimePoints(params.preMitigationSuccessProbabilityGivenEffort, timePointsObjects, effortCDFNormalized, params.effortCDF);

  // Check that the aligned curves yield the right annualized risk
  const annualRiskPostMitigation = calculateExpectedAnnualFatalities(
    alignedPostMitigationSuccessProbabilities,
    params.expectedAnnualAttempts,
    params.expectedFatalitiesPerSuccessfulAttempt,
    effortCDFNormalized
  );

  console.log("annualRiskPostMitigation", annualRiskPostMitigation);

  // Confirm that pre mitigation is always higher than post mitigation at every index
  // for (let i = 0; i < alignedPreMitigationSuccessProbabilities.length; i++) {
  //   if (alignedPreMitigationSuccessProbabilities[i].successProbability < alignedPostMitigationSuccessProbabilities[i].successProbability) {
  //     console.log("index", i)
  //     console.log("preMitigationSuccessProbabilityGivenEffort", alignedPreMitigationSuccessProbabilities[i].successProbability)
  //     console.log("postMitigationSuccessProbability", alignedPostMitigationSuccessProbabilities[i].successProbability)
  //     throw new Error('preMitigationSuccessProbabilityGivenEffort is not always higher than postMitigationSuccessProbability');
  //   }
  // }

  // Get an array that maps points on the post mitigation success probability curve to the pre mitigation success probability curve

  const conversionArray = alignedPostMitigationSuccessProbabilities.map(p => ({
    time: p.time,
    index: findNearestPointBinarySearch(alignedPreMitigationSuccessProbabilities, p.successProbability, "successProbability").successProbability - p.successProbability < 0.0001 ? p.index : findNearestPointBinarySearch(alignedPreMitigationSuccessProbabilities, p.successProbability, "successProbability").index
  }));
  // console.log("conversionArray", conversionArray);
  // const test =  alignedPostMitigationSuccessProbabilities.map(p => ({
  //   time: p.time,
  //   index: Math.abs(findNearestPointBinarySearch(alignedPreMitigationSuccessProbabilities, p.successProbability, "successProbability").successProbability - p.successProbability)
  // }));

  // console.log("test", test)
  // get the post-

  // now map the success distribution to time points
  // console.log("sum of success probabilities", successDistributionAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0));

  // Now renormalize so that the sum under the distribution is the same as before
  // const renormalizationFactor = successDistribution.reduce((acc, p) => acc + p.successProbability, 0) / successDistributionAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0);
  // successDistributionAlignedToTimePoints = successDistributionAlignedToTimePoints.map(p => ({
  //   time: p.time,
  //   successProbability: p.successProbability * renormalizationFactor
  // }));
  // console.log("sum of success probabilities after renormalization", successDistributionAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0));

  // -----------get pre mitigation success distribution ---------------
  const jailbreakTime = params.jailbreakTime;
  // Convert jailbreak time to an index
  const jailbreakIndex = findNearestPointBinarySearch(timePointsObjects, jailbreakTime).index;
  const jailbreakTimeSnapped = findNearestPointBinarySearch(timePointsObjects, jailbreakTime).time;
  console.log("jailbreakTimeSnapped", jailbreakTimeSnapped)
  console.log("confirming jailbreak time snapped is correct", timePointsObjects[jailbreakIndex])



  // const successDistributionPreMitigation  = calculateSuccessDistribution(params.preMitigationSuccessProbabilityGivenEffort, params.effortCDF, timePoints);

  // // now map the success distribution to time points
  // var successDistributionPreMitigationAlignedToTimePoints = timePointsObjects.map(p => ({
  //   time: p.time,
  //   successProbability: p.time > successDistributionPreMitigation[successDistributionPreMitigation.length - 1].time ? 0 : findNearestPointBinarySearch(successDistributionPreMitigation, p.time).successProbability
  // }));
  // // console.log("sum of success probabilities", successDistributionPreMitigation.reduce((acc, p) => acc + p.successProbability, 0));

  // // Now renormalize so that the sum under the distribution is the same as before
  // const renormalizationFactorPreMitigation = successDistributionPreMitigation.reduce((acc, p) => acc + p.successProbability, 0) / successDistributionPreMitigationAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0);
  // successDistributionPreMitigationAlignedToTimePoints = successDistributionPreMitigationAlignedToTimePoints.map(p => ({
  //   time: p.time,
  //   successProbability: p.successProbability * renormalizationFactorPreMitigation
  // }));
  // console.log("sum of success probabilities after renormalization", successDistributionPreMitigationAlignedToTimePoints.reduce((acc, p) => acc + p.successProbability, 0));

  const mainlineRiskProjections = [];
  const jailbreakRiskProjections = [];
  for (let sim = 0; sim < numberOfSimulations; sim++) {

    const numAttemptsInPeriod = Math.floor(lengthOfDeployment / 12 * params.expectedAnnualAttempts); // This was changed
    // const numAttemptsInPeriod = 2
    // console.log("numAttemptsInPeriod", numAttemptsInPeriod)
    const timesAttemptsStart = Array.from({ length: numAttemptsInPeriod }, () => Math.floor(Math.random() * timePoints.length));
    // const timesAttemptsStart = [0, 50]


    /// -----------get risk projections ---------------
    const riskProjection = [] 
    let jailbreakRiskProjection = []
    for (let i = 1; i < timePoints.length; i++) {
      let normalSum = 0
      let jailbreakSum = 0
      for (let attempt = 0; attempt < numAttemptsInPeriod; attempt++) {
        const attemptStart = timesAttemptsStart[attempt];

        if (attemptStart <= i - 1){
          // console.log("CDF----", effortCDFNormalized)
          // console.log(i)
          const probabilityOfTime = effortCDFNormalized[i - attemptStart].cumulativeProbability - effortCDFNormalized[i - attemptStart - 1].cumulativeProbability;
          // console.log(i - attemptStart - 1)

          // console.log("probabilityOfTime", probabilityOfTime)
          // normalSum += alignedPostMitigationSuccessProbabilities[i - attemptStart].successProbability * probabilityOfTime;
          normalSum += alignedPostMitigationSuccessProbabilities[i - attemptStart].successProbability * probabilityOfTime;
          if (i - attemptStart > alignedPostMitigationSuccessProbabilities.length - 1) {
            throw new Error('index out of range');
          }
          // normalSum += effortCDFNormalized[i - attemptStart].cumulativeProbability
          if (i <= jailbreakIndex) {
            jailbreakSum += alignedPostMitigationSuccessProbabilities[i - attemptStart].successProbability * probabilityOfTime;
          } else {
            let relativeIndexOfJailbreak = jailbreakIndex - attemptStart
            /// get start point on pre mitigation curve that corresponds to the jailbreak time
            let successProbability = null
            if (relativeIndexOfJailbreak >= 0) {
              const preMitigationStart = conversionArray[relativeIndexOfJailbreak].index;
              // console.log("preMitigationStart", preMitigationStart)
              const currentPositionRelativeToJailbreak = i - jailbreakIndex;
              // console.log("length", alignedPreMitigationSuccessProbabilities.length)
              successProbability = alignedPreMitigationSuccessProbabilities[preMitigationStart + currentPositionRelativeToJailbreak].successProbability;
            } else {
              const currentPosition = i - attemptStart
              if (currentPosition > alignedPreMitigationSuccessProbabilities.length - 1) {
                throw new Error('index out of range');
              }
              successProbability = alignedPreMitigationSuccessProbabilities[currentPosition].successProbability;
            }
            jailbreakSum += successProbability * probabilityOfTime;
          }
        }


      }
      // console.log("normalSum", normalSum)
      riskProjection.push({
        time: timePoints[i],
        risk: normalSum * params.expectedFatalitiesPerSuccessfulAttempt *  (12 / (lengthOfDeployment / numTimePoints))
      });
      jailbreakRiskProjection.push({
        time: timePoints[i],
        risk: jailbreakSum * params.expectedFatalitiesPerSuccessfulAttempt * (12 / (lengthOfDeployment / numTimePoints))
      });
    }
    // console.log("jailbreakriskProjection", jailbreakRiskProjection)
    // No smoothing applied to individual projections - we'll smooth after aggregation


    mainlineRiskProjections.push(riskProjection);
    jailbreakRiskProjections.push(jailbreakRiskProjection);

    /// -----------get jailbreak risk projection ---------------
  //   const jailbreakRiskProjection = []
  //   for (let i = 0; i < timePoints.length; i++) {
  //     let sum = 0
  //     for (let attempt = 0; attempt < numAttemptsInPeriod; attempt++) {
  //       const attemptStart = timesAttemptsStart[attempt];
  //       if (attemptStart <= i){
  //         if (timePoints[i] <= jailbreakTime) {
  //           sum += successDistributionAlignedToTimePoints[i - attemptStart].successProbability;
  //         } else if (timePoints[i] > jailbreakTime) {
  //           sum += successDistributionPreMitigationAlignedToTimePoints[i - attemptStart].successProbability;
  //         }
  //       }
  //     }
  //     jailbreakRiskProjection.push({
  //       time: timePoints[i],
  //       risk: sum * params.expectedFatalitiesPerSuccessfulAttempt * (12 / (lengthOfDeployment / numTimePoints))
  //     });
  //   }
  //   jailbreakRiskProjections.push(jailbreakRiskProjection);
  }
  // console.log("mainlineRiskProjections", mainlineRiskProjections)

  // accumulate simulation results by averaging risk projections
  let mainlineRiskProjectionAggregated = []
  for (let i = 0; i < timePoints.length - 1; i++) {
    let sumValuesAtTime = 0
    for (let j = 0; j < mainlineRiskProjections.length; j++) {
      sumValuesAtTime += mainlineRiskProjections[j][i] .risk;
    }
    const average = sumValuesAtTime / mainlineRiskProjections.length;

    mainlineRiskProjectionAggregated.push({
      time: timePoints[i],
      risk: average
    });
  }

  // aggregate jailbreak risk projection
  let jailbreakRiskProjectionAggregated = []
  for (let i = 0; i < timePoints.length - 1; i++) {
    let sumValuesAtTime = 0
    for (let j = 0; j < jailbreakRiskProjections.length; j++) {
      sumValuesAtTime += jailbreakRiskProjections[j][i] .risk;
    }
    const average = sumValuesAtTime / jailbreakRiskProjections.length;

    jailbreakRiskProjectionAggregated.push({
      time: timePoints[i],
      risk: average
    });
  }
  
  // Apply smoothing to the aggregated projections
  applyGaussianSmoothing(mainlineRiskProjectionAggregated);

  // only apply smoothing to jailbreak points after jailbreak

  let smoothedMainlinePointsBeforeJailbreak = []
  let pointsAfterJailbreak = []
  for (let i = 0; i < jailbreakRiskProjectionAggregated.length; i++) {
    if (i <= jailbreakIndex) {
      smoothedMainlinePointsBeforeJailbreak.push({
        time: timePoints[i],
        risk: mainlineRiskProjectionAggregated[i].risk
      });
    } else {
      pointsAfterJailbreak.push({
        time: timePoints[i],
        risk: jailbreakRiskProjectionAggregated[i].risk
      });
    }
  }
  // const smoothedPointsAfterJailbreak = applyGaussianSmoothing(pointsAfterJailbreak);
  applyGaussianSmoothing(pointsAfterJailbreak);

  const smoothedJailbreakRiskProjection = smoothedMainlinePointsBeforeJailbreak.concat(pointsAfterJailbreak);

  // applyGaussianSmoothing(jailbreakRiskProjectionAggregated);
  
  simulationResults.mainlineRiskProjection = mainlineRiskProjectionAggregated;
  simulationResults.riskProjectionWithJailbreak = smoothedJailbreakRiskProjection;

  return simulationResults;
}

