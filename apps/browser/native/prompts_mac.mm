#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>
#include <functional>
#include "browser.h"
namespace {
NSMutableDictionary* pending;
NSString* StringAttribute(id node,SEL selector){
 if(![node respondsToSelector:selector])return @"";
 id value=[node performSelector:selector];return [value isKindOfClass:[NSString class]]?value:@"";
}
bool IsWebContent(id node){return [StringAttribute(node,@selector(accessibilityRole)) isEqualToString:@"AXWebArea"]||[NSStringFromClass([node class]) containsString:@"RenderWidgetHostView"];}
NSArray* NativeDialogs(){
 NSMutableArray* dialogs=[NSMutableArray array];size_t visited=0;
 std::function<void(id,int)> visit=[&](id node,int depth){if(!node||depth>24||++visited>6000||IsWebContent(node))return;
  @try{const auto role=StringAttribute(node,@selector(accessibilityRole)),subrole=StringAttribute(node,@selector(accessibilitySubrole));
   if([role isEqualToString:@"AXDialog"]||[role isEqualToString:@"AXSheet"]||[subrole isEqualToString:@"AXDialog"]){if(![dialogs containsObject:node])[dialogs addObject:node];return;}
   NSArray* children=[node respondsToSelector:@selector(accessibilityChildren)]?[node accessibilityChildren]:nil;for(id child in children)visit(child,depth+1);
  }@catch(NSException* exception){}
 };
 for(NSWindow* window in [NSApp windows])visit(window,0);
 return dialogs;
}
NSDictionary* ReadDialog(id root){
 NSMutableArray* texts=[NSMutableArray array];NSMutableDictionary* buttons=[NSMutableDictionary dictionary];NSMutableArray* order=[NSMutableArray array];bool complete=true;size_t count=0;
 std::function<void(id,int)> visit=[&](id node,int depth){if(!node||IsWebContent(node))return;if(depth>24||++count>1000){complete=false;return;}
  @try{NSString* role=StringAttribute(node,@selector(accessibilityRole));NSString* label=StringAttribute(node,@selector(accessibilityLabel));if(!label.length)label=StringAttribute(node,@selector(accessibilityTitle));
   if([role isEqualToString:@"AXStaticText"]){NSString* value=StringAttribute(node,@selector(accessibilityValue));if(value.length)label=value;}
   if(label.length>4096){complete=false;return;}
   if([role isEqualToString:@"AXButton"]&&label.length&&[node respondsToSelector:@selector(accessibilityPerformPress)]){NSString* key=[[NSUUID UUID]UUIDString];[buttons setObject:@{@"node":node,@"label":label} forKey:key];[order addObject:key];}
   else if(label.length&&![texts containsObject:label])[texts addObject:label];
   NSArray* children=[node respondsToSelector:@selector(accessibilityChildren)]?[node accessibilityChildren]:nil;for(id child in children)visit(child,depth+1);
  }@catch(NSException* exception){complete=false;}
 };visit(root,0);
 if(!complete||!texts.count||!buttons.count||buttons.count>16)return nil;
 return @{@"root":root,@"texts":texts,@"buttons":buttons,@"order":order};
}
}
CefRefPtr<CefDictionaryValue> GirruNativePrompts(){
 auto result=CefDictionaryValue::Create();auto list=CefListValue::Create();
 @autoreleasepool{if(!pending)pending=[[NSMutableDictionary alloc]init];NSArray* roots=NativeDialogs();NSMutableSet* alive=[NSMutableSet set];size_t index=0;
  for(id root in roots){NSDictionary* current=ReadDialog(root);if(!current)continue;NSString* key=nil;
   for(NSString* existing in pending){NSDictionary* saved=pending[existing];if(saved[@"root"]==root&&[saved[@"texts"] isEqual:current[@"texts"]]){key=existing;break;}}
   if(!key){key=[[NSUUID UUID]UUIDString];pending[key]=current;}[alive addObject:key];NSDictionary* saved=pending[key];
   auto item=CefDictionaryValue::Create();item->SetString("id",[key UTF8String]);auto texts=CefListValue::Create();size_t t=0;for(NSString* text in saved[@"texts"])texts->SetString(t++,[text UTF8String]);item->SetList("texts",texts);
   auto actions=CefListValue::Create();size_t a=0;for(NSString* action in saved[@"order"]){NSDictionary* button=saved[@"buttons"][action];id node=button[@"node"];auto value=CefDictionaryValue::Create();value->SetString("id",[action UTF8String]);value->SetString("label",[button[@"label"]UTF8String]);value->SetBool("enabled",[node respondsToSelector:@selector(isAccessibilityEnabled)]&&[node isAccessibilityEnabled]);actions->SetDictionary(a++,value);}item->SetList("actions",actions);list->SetDictionary(index++,item);
  }
  for(NSString* key in [pending allKeys])if(![alive containsObject:key])[pending removeObjectForKey:key];
 }result->SetList("prompts",list);result->SetBool("ok",true);return result;
}
bool RespondGirruNativePrompt(const std::string& prompt,const std::string& action){
 @autoreleasepool{
  if(prompt.size()>64||action.size()>64)return false;NSString* key=[NSString stringWithUTF8String:prompt.c_str()];NSDictionary* saved=pending[key];if(!saved)return false;
  id root=saved[@"root"];if(![NativeDialogs() containsObject:root])return false;NSDictionary* current=ReadDialog(root);if(!current||![current[@"texts"]isEqual:saved[@"texts"]])return false;
  NSDictionary* button=saved[@"buttons"][[NSString stringWithUTF8String:action.c_str()]];id node=button[@"node"];if(!node||![node respondsToSelector:@selector(isAccessibilityEnabled)]||![node isAccessibilityEnabled])return false;
  bool present=false;for(NSDictionary* entry in [current[@"buttons"]allValues])if(entry[@"node"]==node&&[entry[@"label"]isEqual:button[@"label"]])present=true;if(!present)return false;
  [node retain];[pending removeObjectForKey:key];BOOL performed=NO;@try{performed=[node accessibilityPerformPress];}@catch(NSException* exception){}[node release];return performed;
 }
}

std::string GirruRequestId(){@autoreleasepool{return [[[NSUUID UUID]UUIDString]UTF8String];}}
