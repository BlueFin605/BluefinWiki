import AWSXRay from 'aws-xray-sdk-core';

AWSXRay.setContextMissingStrategy('IGNORE_ERROR');

/** Record the route as an X-Ray annotation (filter: annotation.route = "GET /pages/{guid}"). Best effort. */
export function annotateRoute(routeKey: string): void {
  try {
    const segment = AWSXRay.getSegment();
    if (!segment) return;
    const sub = segment.addNewSubsegment('router');
    sub.addAnnotation('route', routeKey);
    sub.close();
  } catch {
    // tracing must never fail a request
  }
}
