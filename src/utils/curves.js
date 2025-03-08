import * as math from "mathjs";

const ANCHOR_MONTHS = [3, 12, 36, 60];

// Fit monotonic cubic Hermite spline for success probability and effort CDF
export const fitCurveWithFritschCarlson = (x, points, xs) => {
  const logX = Math.log(x);

  // Compute slopes between points
  const slopes = [];
  for (let i = 0; i < xs.length - 1; i++) {
    slopes.push((points[i + 1] - points[i]) / (xs[i + 1] - xs[i]));
  }

  // Compute tangents using Fritsch-Carlson method
  const tangents = new Array(xs.length);
  tangents[0] = slopes[0] * 1.5; // Moderate increase in initial slope for concavity while maintaining monotonicity
  tangents[xs.length - 1] = 0; // Force horizontal at end

  // For middle points, use harmonic mean if slopes have same sign
  for (let i = 1; i < xs.length - 1; i++) {
    if (slopes[i - 1] * slopes[i] > 0) {
      const w1 = 2 * slopes[i] + slopes[i - 1];
      const w2 = slopes[i] + 2 * slopes[i - 1];
      tangents[i] = (w1 + w2) / (3 * (w1 / slopes[i - 1] + w2 / slopes[i]));
    } else {
      tangents[i] = 0;
    }
  }

  // Find which segment the point is in
  let i = 0;
  while (i < xs.length - 1 && logX > xs[i + 1]) i++;
  if (i === xs.length - 1) return points[i];

  // Compute Hermite basis functions
  const h = xs[i + 1] - xs[i];
  const t = (logX - xs[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  // Return interpolated value and ensure it's between 0 and 1
  return Math.min(1, Math.max(0,
    h00 * points[i] +
    h10 * h * tangents[i] +
    h01 * points[i + 1] +
    h11 * h * tangents[i + 1]
  ));
};



// Fit effort CDF curve
export const fitEffortCDF = (x, panch1, panch2, panch3, panch4) => {
  return fitCurveWithFritschCarlson(
    x,
    [0, panch1 / 100, panch2 / 100, panch3 / 100, panch4 / 100],
    [Math.log(0.1), ...ANCHOR_MONTHS.map(x => Math.log(x))]
  );
};

// Fit logistic curve with additional monotonicity constraints
// Generate points for a curve using Fritsch-Carlson interpolation
export const generateCurvePoints = (params, valueKey = 'successProbability') => {
  const points = [];
  const values = [params.successanch1 / 100, params.successanch2 / 100, params.successanch3 / 100];

  // Calculate the value at 36 months (last anchor point)
  const valueAt36 = fitCurveWithFritschCarlson(
    36,
    [0, ...values],
    [Math.log(0.1), ...ANCHOR_MONTHS.map(x => Math.log(x))]
  );

  // Generate points from 0.1 to 60 months on a log scale
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const time = Math.exp(Math.log(0.1) + x * (Math.log(60) - Math.log(0.1)));

    // Use valueAt36 for any time beyond 36 months
    const value = time > 36 ? valueAt36 : fitCurveWithFritschCarlson(
      time,
      [0, ...values],
      [Math.log(0.1), ...ANCHOR_MONTHS.map(x => Math.log(x))]
    );

    points.push({
      time,
      [valueKey]: value
    });
  }

  return points;
};
