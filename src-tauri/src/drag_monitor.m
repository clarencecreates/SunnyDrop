#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <objc/runtime.h>
#include <math.h>
typedef void (*DragCallback)(int);
static DragCallback callback;
static BOOL pressedBefore=NO, activeDrag=NO, shown=NO, suppressed=NO;
static NSInteger baseline;
static NSPoint origin;
static NSUInteger releaseToken=0;
static BOOL hasPDF(NSPasteboard *board) {
 NSArray *urls=[board readObjectsForClasses:@[[NSURL class]] options:@{NSPasteboardURLReadingFileURLsOnlyKey:@YES}];
 for(NSURL *url in urls)if([url.pathExtension.lowercaseString isEqualToString:@"pdf"])return YES;
 return NO;
}
void sunny_reset_menu(void){shown=NO;suppressed=YES;}
void sunny_place_window(void *ptr,double width,double height,BOOL nearCursor){
 NSWindow *window=(__bridge NSWindow*)ptr;
 NSPoint mouse=NSEvent.mouseLocation;
 NSScreen *screen=NSScreen.mainScreen;
 for(NSScreen *candidate in NSScreen.screens)if(NSPointInRect(mouse,candidate.frame)){screen=candidate;break;}
 NSRect bounds=screen.visibleFrame;
 width=MIN(width,bounds.size.width);height=MIN(height,bounds.size.height);
 NSPoint point=nearCursor?NSMakePoint(mouse.x-width/2,mouse.y-height/2):NSMakePoint(NSMidX(bounds)-width/2,NSMidY(bounds)-height/2);
 point.x=MAX(NSMinX(bounds),MIN(point.x,NSMaxX(bounds)-width));point.y=MAX(NSMinY(bounds),MIN(point.y,NSMaxY(bounds)-height));
 [window setFrame:NSMakeRect(point.x,point.y,width,height) display:YES];
 window.level=NSFloatingWindowLevel;
 window.collectionBehavior=NSWindowCollectionBehaviorCanJoinAllSpaces|NSWindowCollectionBehaviorFullScreenAuxiliary;
 window.hidesOnDeactivate=NO;window.hasShadow=NO;
 window.opaque=NO;window.backgroundColor=NSColor.clearColor;
 if(!nearCursor){
  static char effectKey;
  NSVisualEffectView *effect=objc_getAssociatedObject(window,&effectKey);
  if(!effect){
   effect=[[NSVisualEffectView alloc] initWithFrame:NSInsetRect(window.contentView.bounds,10,10)];
   effect.material=NSVisualEffectMaterialPopover;effect.blendingMode=NSVisualEffectBlendingModeBehindWindow;effect.state=NSVisualEffectStateActive;
   effect.appearance=[NSAppearance appearanceNamed:NSAppearanceNameAqua];
   effect.wantsLayer=YES;effect.layer.cornerRadius=22;effect.layer.masksToBounds=YES;
   effect.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;
   [window.contentView addSubview:effect positioned:NSWindowBelow relativeTo:nil];
   objc_setAssociatedObject(window,&effectKey,effect,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  effect.frame=NSInsetRect(window.contentView.bounds,10,10);
 }
}
void sunny_start_monitor(DragCallback handler){
 callback=handler;baseline=[NSPasteboard pasteboardWithName:NSPasteboardNameDrag].changeCount;
 [NSTimer scheduledTimerWithTimeInterval:.025 repeats:YES block:^(NSTimer *timer){
  BOOL pressed=(NSEvent.pressedMouseButtons&1)!=0;
  NSPasteboard *board=[NSPasteboard pasteboardWithName:NSPasteboardNameDrag];
  NSPoint mouse=NSEvent.mouseLocation;
  if(!pressed){
   if(pressedBefore){NSUInteger token=++releaseToken;dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(.25*NSEC_PER_SEC)),dispatch_get_main_queue(),^{if(token==releaseToken&&shown){shown=NO;callback(0);}});}
   pressedBefore=NO;activeDrag=NO;suppressed=NO;baseline=board.changeCount;origin=mouse;return;
  }
  if(!pressedBefore){pressedBefore=YES;++releaseToken;origin=mouse;}
  if(hypot(mouse.x-origin.x,mouse.y-origin.y)>5&&board.changeCount!=baseline&&hasPDF(board))activeDrag=YES;
  CGEventFlags flags=CGEventSourceFlagsState(kCGEventSourceStateCombinedSessionState);
  BOOL shouldShow=activeDrag&&(flags&kCGEventFlagMaskShift)&&!suppressed;
  if(shouldShow&&!shown){shown=YES;callback(1);}else if(!shouldShow&&shown){shown=NO;callback(0);}
 }];
}

void sunny_resize_popup(void *ptr,double height){
 NSWindow *window=(__bridge NSWindow*)ptr;
 NSRect bounds=(window.screen?:NSScreen.mainScreen).visibleFrame,frame=window.frame;
 height=MIN(height,bounds.size.height);
 frame.origin.y=MAX(NSMinY(bounds),MIN(NSMaxY(frame)-height,NSMaxY(bounds)-height));
 frame.origin.x=MAX(NSMinX(bounds),MIN(frame.origin.x,NSMaxX(bounds)-frame.size.width));
 frame.size.height=height;[window setFrame:frame display:YES];
}

void sunny_play_note(unsigned int index,const unsigned char *bytes,size_t length){
 static NSSound *notes[8];if(index>=8)return;
 if(!notes[index]){NSData *data=[NSData dataWithBytes:bytes length:length];notes[index]=[[NSSound alloc] initWithData:data];notes[index].volume=.4;}
 [notes[index] stop];[notes[index] play];
}

// Tao's drag_resize_window is unsupported on macOS. Track the resize gesture
// in AppKit screen coordinates instead; keep the upper-left corner fixed.
void sunny_begin_popup_resize(void *ptr){
 NSWindow *window=(__bridge NSWindow*)ptr;
 static NSTimer *resizeTimer;
 [resizeTimer invalidate];
 NSPoint start=NSEvent.mouseLocation;
 NSRect original=window.frame;
 NSRect bounds=(window.screen?:NSScreen.mainScreen).visibleFrame;
 resizeTimer=[NSTimer scheduledTimerWithTimeInterval:1.0/60.0 repeats:YES block:^(NSTimer *timer){
  if(!(NSEvent.pressedMouseButtons&1)||!window.visible){[timer invalidate];return;}
  NSPoint mouse=NSEvent.mouseLocation;
  double maxWidth=MAX(320,NSMaxX(bounds)-original.origin.x);
  double maxHeight=MAX(220,NSMaxY(original)-NSMinY(bounds));
  double width=MAX(320,MIN(maxWidth,original.size.width+mouse.x-start.x));
  double height=MAX(220,MIN(maxHeight,original.size.height+start.y-mouse.y));
  [window setFrame:NSMakeRect(original.origin.x,NSMaxY(original)-height,width,height) display:YES];
 }];
}
