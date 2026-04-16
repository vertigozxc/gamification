#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AuthSessionModule, NSObject)

RCT_EXTERN_METHOD(openAuthSession:(NSString *)urlString
                  callbackScheme:(NSString *)callbackScheme
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

@end
