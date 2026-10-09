fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("macos") {
        let out=std::env::var("OUT_DIR").unwrap();
        let status=std::process::Command::new("clang").args(["-fobjc-arc","-fblocks","-c","src/drag_monitor.m","-o",&format!("{out}/drag_monitor.o")]).status().unwrap();assert!(status.success());
        let status=std::process::Command::new("ar").args(["rcs",&format!("{out}/libsunnydrag.a"),&format!("{out}/drag_monitor.o")]).status().unwrap();assert!(status.success());
        println!("cargo:rustc-link-search=native={out}");println!("cargo:rustc-link-lib=static=sunnydrag");println!("cargo:rustc-link-lib=framework=AppKit");println!("cargo:rustc-link-lib=framework=CoreGraphics");println!("cargo:rerun-if-changed=src/drag_monitor.m");
    }
    tauri_build::build();
}
