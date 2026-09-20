// Shared Jev Windows backend. .NET Framework / C# 5, built locally by worker.ps1.
// No cloud calls, shell execution, background loop, or automatic elevation.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;

namespace Jev {
public static class NativeDesktop {
    static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 24000000, RecursionLimit = 40 };
    static Dictionary<string, Snapshot> Snapshots = new Dictionary<string, Snapshot>();
    const int MAX_NODES = 300, MAX_TARGETS = 60, TTL_SECONDS = 60;
    class Item { public AutomationElement Element; public Dictionary<string,object> Data; public string Fingerprint; }
    class Snapshot { public string Id, Revision, WindowIdentity, ImageHash; public DateTime Created; public IntPtr Hwnd; public List<Item> Items; public bool Truncated; }
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT key; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk,scan; public uint flags,time; public UIntPtr extra; }
    delegate bool EnumProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder b, int max);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool GetUserObjectInformation(IntPtr h,int index,StringBuilder value,int length,out int needed);
    [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr h);

    static Dictionary<string,object> Obj(params object[] pairs) { var d=new Dictionary<string,object>(); for(int i=0;i<pairs.Length;i+=2)d.Add((string)pairs[i],pairs[i+1]);return d; }
    static string Hash(string s) { using(var h=SHA256.Create()) return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(s))).Replace("-","").ToLowerInvariant(); }
    static string Clip(string s,int n) { s=s??""; return s.Length>n?s.Substring(0,n):s; }
    static string Text(Dictionary<string,object> d,string key,int max=4096) { object v;if(!d.TryGetValue(key,out v)||!(v is string)||((string)v).Length>max)throw new Exception("Invalid "+key);return (string)v; }
    static bool Flag(Dictionary<string,object> d,string key) { object v; return d.TryGetValue(key,out v)&&v is bool&&(bool)v; }
    static Dictionary<string,object> Map(Dictionary<string,object> d,string key) { object v;if(!d.TryGetValue(key,out v)||!(v is Dictionary<string,object>))throw new Exception("Invalid "+key);return (Dictionary<string,object>)v; }
    static int Int(Dictionary<string,object> d,string key,int min,int max) { object v;if(!d.TryGetValue(key,out v)||(v is bool))throw new Exception("Invalid "+key);double n;if(!Double.TryParse(Convert.ToString(v,System.Globalization.CultureInfo.InvariantCulture),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out n)||n<min||n>max||n!=Math.Truncate(n))throw new Exception("Invalid "+key);return (int)n; }
    static IntPtr Handle(Dictionary<string,object> d) { long n;if(!Int64.TryParse(Text(d,"hwnd",32),out n)||n<=0)throw new Exception("Invalid hwnd");var h=new IntPtr(n);if(!IsWindow(h)||!IsWindowVisible(h)||IsIconic(h))throw new Exception("Window unavailable or minimized");return h; }
    static string Title(IntPtr h) { var b=new StringBuilder(2048);GetWindowText(h,b,b.Capacity);return b.ToString(); }
    static string Identity(IntPtr h) { uint p;GetWindowThreadProcessId(h,out p);using(var process=Process.GetProcessById((int)p))return h.ToInt64()+":"+p+":"+process.StartTime.ToUniversalTime().Ticks; }
    static void Desktop() {
        var h=OpenInputDesktop(0,false,1);if(h==IntPtr.Zero)throw new Exception("No accessible interactive desktop (locked/UAC/service session)");
        try { int needed;var b=new StringBuilder(256);if(!GetUserObjectInformation(h,2,b,b.Capacity*2,out needed)||!String.Equals(b.ToString(),"Default",StringComparison.OrdinalIgnoreCase))throw new Exception("Secure or non-default desktop is not supported"); }
        finally { CloseDesktop(h); }
    }
    static void Dpi() { try { if(SetThreadDpiAwarenessContext(new IntPtr(-4))==IntPtr.Zero)SetProcessDPIAware(); } catch(EntryPointNotFoundException) { SetProcessDPIAware(); } }
    static void Foreground(IntPtr h) { if(GetForegroundWindow()!=h)throw new Exception("Target is not foreground; explicitly review and execute focus first"); }
    static void IdleKeys() { foreach(int k in new[]{1,2,4,16,17,18,91,92})if((GetAsyncKeyState(k)&0x8000)!=0)throw new Exception("User is holding a mouse button or modifier; stop and retry after re-observing"); }
    static string Runtime(AutomationElement el) { return String.Join(".",el.GetRuntimeId().Select(x=>x.ToString()).ToArray()); }
    static Item Read(AutomationElement el,bool root) {
        var c=el.Current;var r=c.BoundingRectangle;
        string name=c.IsPassword?"[password]":c.Name, value="";
        object pattern;
        if(!c.IsPassword&&el.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)) value=((ValuePattern)pattern).Current.Value??"";
        var state=new List<string>();
        if(el.TryGetCurrentPattern(TogglePattern.Pattern,out pattern))state.Add("toggle="+((TogglePattern)pattern).Current.ToggleState);
        if(el.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern))state.Add("selected="+((SelectionItemPattern)pattern).Current.IsSelected);
        if(el.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out pattern))state.Add("expanded="+((ExpandCollapsePattern)pattern).Current.ExpandCollapseState);
        var patterns=el.GetSupportedPatterns().Select(p=>p.ProgrammaticName.Replace("PatternIdentifiers.Pattern","")).ToArray();
        string id=root?"window":"u"+Hash(Runtime(el)).Substring(0,24);
        string role=c.ControlType.ProgrammaticName.Replace("ControlType.","").ToLowerInvariant();
        if(role=="edit")role="text field";
        var rect=new double[]{r.IsEmpty?0:Math.Round(r.X),r.IsEmpty?0:Math.Round(r.Y),r.IsEmpty?0:Math.Round(r.Width),r.IsEmpty?0:Math.Round(r.Height)};
        var d=Obj("id",id,"role",role,"label",Clip((name+(value.Length>0?" | value: "+value:"")+" "+String.Join(" ",state.ToArray())).Trim(),200),"enabled",c.IsEnabled&&!c.IsPassword&&!c.IsOffscreen,"rect",rect,"automationId",Clip(c.AutomationId,200),"password",c.IsPassword,"patterns",patterns);
        // Include full Name/value in the local fingerprint, never in logs or cloud output.
        return new Item{Element=el,Data=d,Fingerprint=Json.Serialize(new object[]{id,Hash(name??""),Hash(value),String.Join(" ",state.ToArray()),c.IsEnabled,c.IsOffscreen,c.IsPassword,rect,c.AutomationId})};
    }
    static Snapshot Capture(IntPtr hwnd) {
        Desktop();var root=AutomationElement.FromHandle(hwnd);var items=new List<Item>();var queue=new Queue<AutomationElement>();queue.Enqueue(root);int visited=0;bool truncated=false;
        var walker=TreeWalker.ControlViewWalker;var watch=Stopwatch.StartNew();
        while(queue.Count>0&&visited<MAX_NODES&&items.Count<MAX_TARGETS&&watch.ElapsedMilliseconds<6000) {
            var el=queue.Dequeue();visited++;
            try {
                var item=Read(el,el==root);
                if(el==root||!el.Current.IsOffscreen)items.Add(item);
                var child=walker.GetFirstChild(el);int count=0;
                while(child!=null&&queue.Count<MAX_NODES&&count++<MAX_NODES){queue.Enqueue(child);child=walker.GetNextSibling(child);}
                if(child!=null)truncated=true;
            } catch(ElementNotAvailableException) { throw new Exception("UI changed during observation; observe again"); }
        }
        truncated|=queue.Count>0;
        if(items.Count==0)throw new Exception("UIA did not return the window");
        string ident=Identity(hwnd);string sig=Hash(ident+"|"+String.Join("\n",items.Select(i=>i.Fingerprint).ToArray())+"|"+truncated);
        return new Snapshot{Id=Guid.NewGuid().ToString(),Created=DateTime.UtcNow,Hwnd=hwnd,WindowIdentity=ident,Items=items,Revision=sig,Truncated=truncated};
    }
    static Snapshot Lookup(string id) {
        Snapshot s;if(!Snapshots.TryGetValue(id,out s)||(DateTime.UtcNow-s.Created).TotalSeconds>TTL_SECONDS)throw new Exception("Snapshot missing or expired; observe again");
        if(!IsWindow(s.Hwnd)||Identity(s.Hwnd)!=s.WindowIdentity)throw new Exception("Window identity changed");return s;
    }
    static object Observe(Dictionary<string,object> a) {
        var s=Capture(Handle(a));
        foreach(var k in Snapshots.Where(p=>(DateTime.UtcNow-p.Value.Created).TotalSeconds>TTL_SECONDS).Select(p=>p.Key).ToArray())Snapshots.Remove(k);
        if(Snapshots.Count>=16)Snapshots.Remove(Snapshots.OrderBy(p=>p.Value.Created).First().Key);
        Snapshots.Add(s.Id,s);
        return Obj("snapshotId",s.Id,"hwnd",s.Hwnd.ToInt64().ToString(),"revision",s.Revision,"observedAt",s.Created.ToString("o"),"expiresAt",s.Created.AddSeconds(TTL_SECONDS).ToString("o"),"app",Clip(Title(s.Hwnd),200),"foreground",GetForegroundWindow()==s.Hwnd,"truncated",s.Truncated,"elements",s.Items.Select(i=>i.Data).ToArray());
    }
    static Bitmap Pixels(Snapshot s) {
        Desktop();Foreground(s.Hwnd);RECT r;if(!GetWindowRect(s.Hwnd,out r))throw new Exception("Cannot read window rectangle");
        var window=new Rectangle(r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top);var screen=System.Windows.Forms.SystemInformation.VirtualScreen;
        if(window.Width<1||window.Height<1||window.Width>8192||window.Height>8192||!screen.Contains(window))throw new Exception("Window must be fully on screen and at most 8192 pixels per dimension");
        var bmp=new Bitmap(window.Width,window.Height,PixelFormat.Format32bppArgb);
        try{using(var g=Graphics.FromImage(bmp))g.CopyFromScreen(window.Location,Point.Empty,window.Size,CopyPixelOperation.SourceCopy);return bmp;}catch{bmp.Dispose();throw;}
    }
    static byte[] Png(Bitmap b) { using(var stream=new MemoryStream()){b.Save(stream,ImageFormat.Png);return stream.ToArray();} }
    static string BytesHash(byte[] b) {using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant();}
    static object Screenshot(Dictionary<string,object> a) {
        var s=Lookup(Text(a,"snapshotId",64));
        if(Capture(s.Hwnd).Revision!=s.Revision)throw new Exception("UI changed; observe again before screenshot");
        using(var b=Pixels(s)){
            var bytes=Png(b);if(bytes.Length>12000000)throw new Exception("Screenshot exceeds 12 MB");s.ImageHash=BytesHash(bytes);RECT r;GetWindowRect(s.Hwnd,out r);
            return Obj("snapshotId",s.Id,"mimeType","image/png","data",Convert.ToBase64String(bytes),"imageHash",s.ImageHash,"origin",new[]{r.Left,r.Top},"width",b.Width,"height",b.Height,"coordinateSpace","physical-screen-pixels","note","Visible screen crop; overlays are included. Image is sent only to the calling host, never to Jev by this backend.");
        }
    }
    static void PointScope(Snapshot s,int x,int y) {
        RECT r;GetWindowRect(s.Hwnd,out r);if(x<r.Left||y<r.Top||x>=r.Right||y>=r.Bottom)throw new Exception("Point is outside target window");
        var top=GetAncestor(WindowFromPoint(new POINT{X=x,Y=y}),2);if(top!=s.Hwnd)throw new Exception("Point is obscured or belongs to another window");
    }
    static void Send(params INPUT[] data) { if(SendInput((uint)data.Length,data,Marshal.SizeOf(typeof(INPUT)))!=data.Length)throw new Exception("SendInput incomplete; possible UIPI/input interference. Re-observe before retrying"); }
    static INPUT Mouse(uint flags) {return new INPUT{type=0,data=new UNION{mouse=new MOUSEINPUT{dwFlags=flags}}};}
    static INPUT Key(ushort vk,ushort scan,uint flags) {return new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{vk=vk,scan=scan,flags=flags}}};}
    static void TextInput(string text) {var list=new List<INPUT>();foreach(char c in text){list.Add(Key(0,c,4));list.Add(Key(0,c,6));}if(list.Count>0)Send(list.ToArray());}
    static void Chord(string chord) {
        var parts=chord.ToUpperInvariant().Split('+');if(parts.Length<1||parts.Length>4)throw new Exception("Invalid key chord");
        var mods=new List<ushort>();foreach(var m in parts.Take(parts.Length-1)){ushort n=m=="CTRL"?(ushort)17:m=="ALT"?(ushort)18:m=="SHIFT"?(ushort)16:(ushort)0;if(n==0||mods.Contains(n))throw new Exception("Unsupported modifier");mods.Add(n);}
        var keys=new Dictionary<string,ushort>{{"ENTER",13},{"TAB",9},{"ESCAPE",27},{"BACKSPACE",8},{"DELETE",46},{"LEFT",37},{"RIGHT",39},{"UP",38},{"DOWN",40},{"HOME",36},{"END",35},{"PAGEUP",33},{"PAGEDOWN",34},{"SPACE",32}};
        string last=parts.Last();ushort code;
        if(last.Length==1&&((last[0]>='A'&&last[0]<='Z')||(last[0]>='0'&&last[0]<='9')))code=last[0];
        else if(keys.ContainsKey(last))code=keys[last];else{int f;if(last.StartsWith("F")&&Int32.TryParse(last.Substring(1),out f)&&f>=1&&f<=12)code=(ushort)(111+f);else throw new Exception("Unsupported key");}
        if(mods.Contains(17)&&mods.Contains(18)&&code==46)throw new Exception("Secure attention sequence not supported");
        uint ext=(code>=33&&code<=40)||code==46?1u:0u;
        var inputs=new List<INPUT>();foreach(var m in mods)inputs.Add(Key(m,0,0));inputs.Add(Key(code,0,ext));inputs.Add(Key(code,0,ext|2));foreach(var m in Enumerable.Reverse(mods))inputs.Add(Key(m,0,2));
        try{Send(inputs.ToArray());}catch{foreach(var m in mods)try{Send(Key(m,0,2));}catch{}throw;}
    }
    static void FocusElement(Snapshot s,Item target) {
        Foreground(s.Hwnd);target.Element.SetFocus();Foreground(s.Hwnd);
        if(Runtime(AutomationElement.FocusedElement)!=Runtime(target.Element))throw new Exception("Keyboard focus does not match the target");
    }
    static object Execute(Dictionary<string,object> a) {
        string id=Text(a,"snapshotId",64);var s=Lookup(id);bool preview=!Flag(a,"execute");
        if(!preview)Snapshots.Remove(id); // Any real attempt consumes the observation, including errors.
        var action=Map(a,"action");string kind=Text(action,"type",30),targetId=Text(action,"targetId",80);var args=Map(action,"arguments");
        var current=Capture(s.Hwnd);if(current.Revision!=s.Revision)throw new Exception("UI changed since observation; review a fresh snapshot");
        var target=current.Items.FirstOrDefault(i=>(string)i.Data["id"]==targetId);
        if(target==null||!(bool)target.Data["enabled"])throw new Exception("Target unavailable, offscreen, disabled or password protected");
        string[] allowed={"focus","invoke","click","click_at","drag","set_value","type_text","press_key","scroll","toggle","select","wait"};
        if(!allowed.Contains(kind))throw new Exception("Unsupported action");
        object pattern=null;string text=null;int x=0,y=0,tx=0,ty=0;
        if(kind!="focus"&&kind!="wait")Foreground(s.Hwnd);
        if(kind=="invoke"&&!target.Element.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))throw new Exception("InvokePattern unavailable; propose an explicit click instead");
        if(kind=="toggle"&&!target.Element.TryGetCurrentPattern(TogglePattern.Pattern,out pattern))throw new Exception("TogglePattern unavailable");
        if(kind=="select"&&!target.Element.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern))throw new Exception("SelectionItemPattern unavailable");
        if(kind=="set_value") {text=Text(args,"text",2000);if(!target.Element.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)||((ValuePattern)pattern).Current.IsReadOnly)throw new Exception("Writable ValuePattern unavailable");}
        if(kind=="type_text")text=Text(args,"text",2000);
        if(kind=="scroll"&&!target.Element.TryGetCurrentPattern(ScrollPattern.Pattern,out pattern))throw new Exception("ScrollPattern unavailable");
        if(kind=="click"){
            var p=target.Element.GetClickablePoint();x=(int)Math.Round(p.X);y=(int)Math.Round(p.Y);PointScope(s,x,y);
            var hit=AutomationElement.FromPoint(new System.Windows.Point(x,y));bool found=false;
            for(int i=0;hit!=null&&i<20;i++,hit=TreeWalker.ControlViewWalker.GetParent(hit)){if(Runtime(hit)==Runtime(target.Element)){found=true;break;}}
            if(!found)throw new Exception("Click point does not hit the target");
        }
        if(kind=="click_at"||kind=="drag"){
            if(targetId!="window")throw new Exception("Coordinate action must target the window scope");
            string hash=Text(args,"imageHash",64);if(s.ImageHash==null||hash!=s.ImageHash)throw new Exception("A matching screenshot is required for coordinate actions");
            using(var bmp=Pixels(s))if(BytesHash(Png(bmp))!=hash)throw new Exception("Pixels changed since screenshot; observe and review again");
            x=Int(args,"x",-32768,32767);y=Int(args,"y",-32768,32767);PointScope(s,x,y);
            if(kind=="drag"){tx=Int(args,"toX",-32768,32767);ty=Int(args,"toY",-32768,32767);PointScope(s,tx,ty);}
        }
        if(preview)return Obj("executed",false,"dryRun",true,"snapshotId",id,"action",action,"note","Preflight only; no UI changed and no approval granted");
        Desktop();IdleKeys();
        if(kind=="focus") {if(GetForegroundWindow()!=s.Hwnd&&!SetForegroundWindow(s.Hwnd))throw new Exception("Windows denied foreground activation; focus the target manually");Thread.Sleep(120);Foreground(s.Hwnd);}
        else if(kind=="invoke")((InvokePattern)pattern).Invoke();
        else if(kind=="set_value")((ValuePattern)pattern).SetValue(text);
        else if(kind=="toggle")((TogglePattern)pattern).Toggle();
        else if(kind=="select")((SelectionItemPattern)pattern).Select();
        else if(kind=="type_text"){FocusElement(s,target);TextInput(text);}
        else if(kind=="press_key"){FocusElement(s,target);Chord(Text(args,"key",40));}
        else if(kind=="scroll") {string dir=Text(args,"direction",10);int count=Int(args,"count",1,5);if(!new[]{"up","down","left","right"}.Contains(dir))throw new Exception("Invalid direction");for(int i=0;i<count;i++)((ScrollPattern)pattern).Scroll(dir=="left"?ScrollAmount.SmallDecrement:dir=="right"?ScrollAmount.SmallIncrement:ScrollAmount.NoAmount,dir=="up"?ScrollAmount.SmallDecrement:dir=="down"?ScrollAmount.SmallIncrement:ScrollAmount.NoAmount);}
        else if(kind=="wait")Thread.Sleep(Int(args,"milliseconds",1,2000));
        else {
            Foreground(s.Hwnd);PointScope(s,x,y);if(!SetCursorPos(x,y))throw new Exception("Cannot move cursor");
            if(kind=="drag") {try{Send(Mouse(2));for(int i=1;i<=10;i++){Foreground(s.Hwnd);int dx=x+(tx-x)*i/10,dy=y+(ty-y)*i/10;PointScope(s,dx,dy);SetCursorPos(dx,dy);Thread.Sleep(20);}}finally{Send(Mouse(4));}}
            else Send(Mouse(2),Mouse(4));
        }
        return Obj("executed",true,"snapshotId",id,"requiresObserve",true,"verified",false);
    }
    public static string Dispatch(string line) {
        object requestId=null;
        try{
            Dpi();if(line.Length>65536)throw new Exception("Request too large");var req=Json.Deserialize<Dictionary<string,object>>(line);req.TryGetValue("id",out requestId);var a=Map(req,"args");string method=Text(req,"method",40);object result;
            if(method=="info") {bool interactive=true;try{Desktop();}catch{interactive=false;}result=Obj("platform","windows","backend","UIAutomation/.NET Framework + SendInput","architecture",IntPtr.Size==8?"x64":"x86","interactiveDesktop",interactive,"coordinateSpace","physical-screen-pixels","maxTargets",MAX_TARGETS,"snapshotTtlSeconds",TTL_SECONDS,"executed",false);}
            else if(method=="list") {Desktop();var list=new List<object>();EnumWindows((h,p)=>{if(IsWindowVisible(h)&&!IsIconic(h)){string title=Title(h);if(title.Length>0){uint pid;GetWindowThreadProcessId(h,out pid);list.Add(Obj("hwnd",h.ToInt64().ToString(),"title",Clip(title,200),"pid",pid,"foreground",h==GetForegroundWindow()));}}return list.Count<200;},IntPtr.Zero);result=Obj("windows",list,"executed",false);}
            else if(method=="observe")result=Observe(a);
            else if(method=="screenshot")result=Screenshot(a);
            else if(method=="execute")result=Execute(a);
            else if(method=="reset"){Snapshots.Clear();result=Obj("stopped",true);}
            else throw new Exception("Unknown native method");
            return Json.Serialize(Obj("id",requestId,"result",result));
        }catch(Exception ex){return Json.Serialize(Obj("id",requestId,"error",Clip(ex.Message,300)));}
    }
}
}
