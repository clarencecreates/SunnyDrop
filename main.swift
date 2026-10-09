import SwiftUI
import PDFKit
import UniformTypeIdentifiers

struct PageItem: Identifiable {
    let id = UUID()
    let page: PDFPage
    let original: Int
}

func reorderedDocument(_ pages: [PageItem]) -> PDFDocument? {
    let output = PDFDocument()
    for item in pages {
        guard let copy = item.page.copy() as? PDFPage else { return nil }
        output.insert(copy, at: output.pageCount)
    }
    return output
}

final class Workspace: ObservableObject {
    @Published var pages: [PageItem] = []
    @Published var name = ""
    @Published var message = "Drop a PDF here to arrange its pages."
    @Published var dragging: UUID?
    var source: URL?
    var documents: [PDFDocument] = []

    func load(_ url: URL, append: Bool = false) {
        guard let doc = PDFDocument(url: url), !doc.isLocked, doc.pageCount > 0 else {
            message = "This PDF could not be opened. Unlock password-protected PDFs first."
            return
        }
        if !append { pages = []; documents = []; source = url; name = url.lastPathComponent }
        documents.append(doc)
        for i in 0..<doc.pageCount {
            if let page = doc.page(at: i) { pages.append(PageItem(page: page, original: i + 1)) }
        }
        message = "\(pages.count) pages. Drag thumbnails to reorder; append another PDF to merge."
    }

    func choose(append: Bool = false) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.pdf]
        panel.allowsMultipleSelection = append
        if panel.runModal() == .OK {
            for url in panel.urls { load(url, append: append) }
        }
    }

    func move(_ id: UUID, before target: UUID) {
        guard id != target, let from = pages.firstIndex(where: { $0.id == id }),
              let to = pages.firstIndex(where: { $0.id == target }) else { return }
        withAnimation { pages.move(fromOffsets: IndexSet(integer: from), toOffset: to > from ? to + 1 : to) }
    }

    func save() {
        guard !pages.isEmpty else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pdf]
        panel.nameFieldStringValue = (source?.deletingPathExtension().lastPathComponent ?? "Document") + "-reordered.pdf"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        if let source, url.resolvingSymlinksInPath() == source.resolvingSymlinksInPath() {
            message = "Choose a new filename to preserve the original PDF."
            return
        }
        if documents.contains(where: { $0.documentURL?.resolvingSymlinksInPath() == url.resolvingSymlinksInPath() }) {
            message = "Choose a filename different from all input PDFs."
            return
        }
        guard let output = reorderedDocument(pages) else { message = "Could not copy a page."; return }
        message = output.write(to: url) ? "Saved \(url.lastPathComponent)" : "Could not save the PDF."
    }
}

struct PageDrop: DropDelegate {
    let item: PageItem
    let workspace: Workspace
    func dropEntered(info: DropInfo) {
        if let id = workspace.dragging { workspace.move(id, before: item.id) }
    }
    func dropUpdated(info: DropInfo) -> DropProposal? { DropProposal(operation: .move) }
    func performDrop(info: DropInfo) -> Bool { workspace.dragging = nil; return true }
}

struct ContentView: View {
    @ObservedObject var workspace: Workspace
    @State var targeted = false
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading) {
                    Text("SunnyDrop").font(.largeTitle.bold())
                    Text(workspace.name.isEmpty ? "Arrange and merge PDFs locally" : workspace.name).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Open PDF") { workspace.choose() }.keyboardShortcut("o")
                Button("Append PDF") { workspace.choose(append: true) }.disabled(workspace.pages.isEmpty)
                Button("Save As…") { workspace.save() }.keyboardShortcut("s").disabled(workspace.pages.isEmpty)
            }
            if workspace.pages.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "doc.badge.arrow.up").font(.system(size: 60)).foregroundStyle(.orange)
                    Text("Drop a PDF").font(.title2.bold())
                    Text("Preview pages, drag to reorder, and save a new copy.").foregroundStyle(.secondary)
                    Button("Choose PDF…") { workspace.choose() }
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 20)], spacing: 20) {
                        ForEach(Array(workspace.pages.enumerated()), id: \.element.id) { index, item in
                            VStack(spacing: 8) {
                                Image(nsImage: item.page.thumbnail(of: NSSize(width: 240, height: 310), for: .mediaBox))
                                    .resizable().scaledToFit().frame(height: 210)
                                    .background(.white).clipShape(RoundedRectangle(cornerRadius: 6))
                                Text("\(index + 1)").font(.headline)
                                Text("Original page \(item.original)").font(.caption).foregroundStyle(.secondary)
                            }
                            .padding(12).frame(maxWidth: .infinity)
                            .background(workspace.dragging == item.id ? Color.orange.opacity(0.25) : Color.secondary.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .onDrag { workspace.dragging = item.id; return NSItemProvider(object: item.id.uuidString as NSString) }
                            .onDrop(of: [.text], delegate: PageDrop(item: item, workspace: workspace))
                            .contextMenu {
                                Button("Move to beginning") {
                                    if let i = workspace.pages.firstIndex(where: { $0.id == item.id }) {
                                        workspace.pages.move(fromOffsets: IndexSet(integer: i), toOffset: 0)
                                    }
                                }
                                Button("Move to end") {
                                    if let i = workspace.pages.firstIndex(where: { $0.id == item.id }) {
                                        workspace.pages.move(fromOffsets: IndexSet(integer: i), toOffset: workspace.pages.count)
                                    }
                                }
                            }
                        }
                    }.padding(8)
                }
            }
            Text(workspace.message).font(.callout).foregroundStyle(.secondary)
        }
        .padding(24).frame(minWidth: 760, minHeight: 560)
        .background(targeted ? Color.orange.opacity(0.08) : Color.clear)
        .onDrop(of: [.fileURL], isTargeted: $targeted) { providers in
            guard let provider = providers.first else { return false }
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { value, _ in
                let url: URL?
                if let data = value as? Data { url = URL(dataRepresentation: data, relativeTo: nil) }
                else { url = value as? URL }
                if let url { DispatchQueue.main.async { workspace.load(url) } }
            }
            return true
        }
    }
}

enum FileAction: String, CaseIterable { case reorder = "Reorder", merge = "Merge", compress = "Compress" }

func pdfURLs(_ board: NSPasteboard) -> [URL] {
    let urls = board.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL] ?? []
    guard !urls.isEmpty, urls.allSatisfy({ $0.isFileURL && $0.pathExtension.lowercased() == "pdf" }) else { return [] }
    return urls
}

final class ActionDropView: NSView {
    var chosen: ((FileAction, [URL]) -> Void)?
    var hover: Int?
    override init(frame: NSRect) {
        super.init(frame: frame)
        registerForDraggedTypes([.fileURL])
    }
    required init?(coder: NSCoder) { fatalError() }
    override func draw(_ dirtyRect: NSRect) {
        NSColor.windowBackgroundColor.withAlphaComponent(0.97).setFill()
        NSBezierPath(roundedRect: bounds, xRadius: 16, yRadius: 16).fill()
        for (i, action) in FileAction.allCases.enumerated() {
            let rect = NSRect(x: CGFloat(i) * 112 + 6, y: 8, width: 100, height: 70)
            if hover == i {
                NSColor.systemOrange.withAlphaComponent(0.25).setFill()
                NSBezierPath(roundedRect: rect, xRadius: 10, yRadius: 10).fill()
            }
            let icon = ["arrow.left.arrow.right", "doc.on.doc", "arrow.down.right.and.arrow.up.left"][i]
            NSImage(systemSymbolName: icon, accessibilityDescription: action.rawValue)?.draw(in: NSRect(x: rect.midX-12, y: 43, width: 24, height: 24))
            let text = action.rawValue as NSString
            let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: NSColor.labelColor]
            text.draw(at: NSPoint(x: rect.midX-text.size(withAttributes: attributes).width/2, y: 18), withAttributes: attributes)
        }
    }
    func update(_ info: NSDraggingInfo) -> NSDragOperation {
        let urls = pdfURLs(info.draggingPasteboard)
        guard !urls.isEmpty else { hover = nil; needsDisplay = true; return [] }
        let point = convert(info.draggingLocation, from: nil)
        let index = min(2, max(0, Int(point.x / 112)))
        hover = index; needsDisplay = true
        if index == 1 && urls.count < 2 { return [] }
        return .copy
    }
    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation { update(sender) }
    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation { update(sender) }
    override func draggingExited(_ sender: NSDraggingInfo?) { hover = nil; needsDisplay = true }
    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool { update(sender) == .copy }
    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let urls = pdfURLs(sender.draggingPasteboard)
        guard let index = hover, !urls.isEmpty, index != 1 || urls.count >= 2 else { return false }
        let action = FileAction.allCases[index]
        DispatchQueue.main.async { [weak self] in self?.chosen?(action, urls) }
        return true
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var status: NSStatusItem!
    var panel: NSPanel!
    var editor: NSWindow?
    var timer: Timer?
    var globalMonitor: Any?
    var localMonitor: Any?
    var baseline = 0
    var wasPressed = false
    var startPoint = NSPoint.zero
    var activeDrag = false
    var pendingRelease = false
    var manualMenu = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        status.button?.image = NSImage(systemSymbolName: "doc.on.doc", accessibilityDescription: "SunnyDrop")
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Drag PDFs, hold Shift + Option, then drop on an action", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Merge requires two or more PDFs", action: nil, keyEquivalent: ""))
        menu.addItem(.separator())
        let show = NSMenuItem(title: "Show drop menu", action: #selector(showDropMenu), keyEquivalent: "")
        show.target = self; menu.addItem(show)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit SunnyDrop", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        status.menu = menu
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 336, height: 86), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating; panel.isOpaque = false; panel.backgroundColor = .clear
        panel.hasShadow = true; panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let drop = ActionDropView(frame: NSRect(x: 0, y: 0, width: 336, height: 86))
        drop.chosen = { [weak self] action, urls in self?.handle(action, urls: urls) }
        panel.contentView = drop
        baseline = NSPasteboard(name: .drag).changeCount
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] _ in self?.beginGesture() }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] event in self?.beginGesture(); return event }
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in self?.pollDrag() }
    }

    func beginGesture() {
        baseline = NSPasteboard(name: .drag).changeCount
        startPoint = NSEvent.mouseLocation
        activeDrag = false; wasPressed = true; pendingRelease = false
    }

    func pollDrag() {
        let pressed = NSEvent.pressedMouseButtons & 1 != 0
        if pressed && !wasPressed { beginGesture() }
        if !pressed {
            if wasPressed {
                // Let AppKit deliver performDragOperation before dismissing the destination.
                pendingRelease = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                    guard let self, self.pendingRelease else { return }
                    self.panel.orderOut(nil); self.activeDrag = false
                }
            }
            wasPressed = false
            return
        }
        wasPressed = true
        let board = NSPasteboard(name: .drag)
        let point = NSEvent.mouseLocation
        let moved = hypot(point.x-startPoint.x, point.y-startPoint.y) > 5
        if moved && board.changeCount != baseline && !pdfURLs(board).isEmpty { activeDrag = true }
        let modifiers = CGEventSource.flagsState(.combinedSessionState)
        let shortcut = modifiers.contains(.maskShift) && modifiers.contains(.maskAlternate)
        if manualMenu || (activeDrag && shortcut) {
            if !panel.isVisible { positionMenu(at: point); panel.orderFrontRegardless() }
        } else if panel.isVisible { panel.orderOut(nil) }
    }

    func positionMenu(at point: NSPoint) {
        let screen = NSScreen.screens.first(where: { $0.frame.contains(point) }) ?? NSScreen.main
        let visible = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1000, height: 800)
        let x = min(max(point.x - 168, visible.minX), visible.maxX-336)
        let y = min(max(point.y + 24, visible.minY), visible.maxY-86)
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }
    @objc func showDropMenu() {
        manualMenu = true
        positionMenu(at: NSEvent.mouseLocation); panel.orderFrontRegardless()
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
            self?.manualMenu = false
            if self?.activeDrag == false { self?.panel.orderOut(nil) }
        }
    }

    func alert(_ text: String) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert(); alert.messageText = text; alert.runModal()
    }

    func handle(_ action: FileAction, urls: [URL]) {
        panel.orderOut(nil); activeDrag = false; manualMenu = false
        switch action {
        case .reorder:
            for url in urls {
                guard let doc = PDFDocument(url: url), !doc.isLocked, doc.pageCount > 0 else {
                    alert("Could not open \(url.lastPathComponent). Unlock encrypted PDFs first."); return
                }
            }
            let workspace = Workspace()
            for (i, url) in urls.enumerated() { workspace.load(url, append: i > 0) }
            guard !workspace.pages.isEmpty else { alert(workspace.message); return }
            editor?.close()
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 680), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            window.title = "Reorder PDF pages"; window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: ContentView(workspace: workspace))
            window.center(); editor = window
            NSApp.activate(ignoringOtherApps: true); window.makeKeyAndOrderFront(nil)
        case .merge:
            guard urls.count >= 2 else { alert("Drop at least two PDFs onto Merge."); return }
            var pages: [PageItem] = []
            var documents: [PDFDocument] = []
            for url in urls {
                guard let doc = PDFDocument(url: url), !doc.isLocked, doc.pageCount > 0 else { alert("Could not open \(url.lastPathComponent). Unlock encrypted PDFs first."); return }
                documents.append(doc)
                for i in 0..<doc.pageCount { if let page = doc.page(at: i) { pages.append(PageItem(page: page, original: i+1)) } }
            }
            NSApp.activate(ignoringOtherApps: true)
            let save = NSSavePanel(); save.allowedContentTypes = [.pdf]; save.nameFieldStringValue = "Merged.pdf"
            guard save.runModal() == .OK, let destination = save.url else { return }
            guard !urls.contains(where: { $0.resolvingSymlinksInPath() == destination.resolvingSymlinksInPath() }) else { alert("Choose a new filename to preserve the input PDFs."); return }
            guard let output = reorderedDocument(pages), output.write(to: destination) else { alert("Could not save the merged PDF."); return }
            NSWorkspace.shared.activateFileViewerSelecting([destination])
        case .compress:
            let engine = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Applications/LocalPDF.app/Contents/MacOS/LocalPDF")
            guard FileManager.default.isExecutableFile(atPath: engine.path) else { alert("Compress requires the installed LocalPDF app."); return }
            let process = Process(); process.executableURL = engine
            process.arguments = ["compress"] + urls.map(\.path)
            do { try process.run() } catch { alert("Could not start compression: \(error.localizedDescription)") }
        }
    }
    func applicationWillTerminate(_ notification: Notification) {
        timer?.invalidate()
        if let monitor = globalMonitor { NSEvent.removeMonitor(monitor) }
        if let monitor = localMonitor { NSEvent.removeMonitor(monitor) }
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.run()
