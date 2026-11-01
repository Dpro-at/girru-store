// Cocoa event-loop bootstrap adapted from CEF's BSD-licensed cefsimple sample.
// Copyright (c) 2013 The Chromium Embedded Framework Authors. See CEF-LICENSE.txt.
#import <Cocoa/Cocoa.h>
#include "include/cef_application_mac.h"
#include "include/cef_command_line.h"
#include "include/wrapper/cef_helpers.h"
#include "include/wrapper/cef_library_loader.h"
#include "browser.h"
@interface GirruApplication : NSApplication <CefAppProtocol>{BOOL handling_;}
@end
@implementation GirruApplication
- (BOOL)isHandlingSendEvent{return handling_;}
- (void)setHandlingSendEvent:(BOOL)value{handling_=value;}
- (void)sendEvent:(NSEvent*)event{CefScopedSendingEvent scoper;[super sendEvent:event];}
- (void)terminate:(id)sender{CloseGirruBrowsers();}
@end
void HideGirruBrowser(CefWindowHandle handle){
 @autoreleasepool{NSView* view=(NSView*)handle;NSWindow* window=[view window];if(window){[window setAlphaValue:0];[window setIgnoresMouseEvents:YES];if(![window isVisible])[window orderBack:nil];}}
}
int main(int argc,char* argv[]){
 CefScopedLibraryLoader library;if(!library.LoadInMain())return 1;
 CefMainArgs args(argc,argv);
 @autoreleasepool{
  [GirruApplication sharedApplication];
  auto command=CefCommandLine::CreateCommandLine();command->InitFromArgv(argc,argv);
  CefSettings settings;CefString(&settings.root_cache_path)=command->GetSwitchValue("cache-path");
  CefString(&settings.cache_path)=command->GetSwitchValue("cache-path");
  settings.remote_debugging_port=std::stoi(command->GetSwitchValue("remote-debugging-port").ToString());
  settings.persist_session_cookies=true;
  auto application=CreateGirruApp();
  if(!CefInitialize(args,settings,application,nullptr))return CefGetExitCode();
  NSMenu* bar=[[NSMenu alloc]init];NSMenuItem* menuItem=[[NSMenuItem alloc]init];[bar addItem:menuItem];
  NSMenu* menu=[[NSMenu alloc]initWithTitle:@"Girru Browser"];[menu addItemWithTitle:@"Quit Girru Browser" action:@selector(terminate:) keyEquivalent:@"q"];[menuItem setSubmenu:menu];[NSApp setMainMenu:bar];
  if(command->HasSwitch("girru-embedded")){[NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];}else{[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];[NSApp activateIgnoringOtherApps:YES];}
  CefRunMessageLoop();CefShutdown();
 }
 return 0;
}
