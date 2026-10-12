fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("macos") {
        let out=std::env::var("OUT_DIR").unwrap();
        // compile for the Rust target's architecture, so universal (arm64 + x86_64) builds link
        let arch=match std::env::var("CARGO_CFG_TARGET_ARCH").as_deref(){Ok("x86_64")=>"x86_64",_=>"arm64"};
        let status=std::process::Command::new("clang").args(["-arch",arch,"-mmacosx-version-min=13.0","-fobjc-arc","-fblocks","-c","src/drag_monitor.m","-o",&format!("{out}/drag_monitor.o")]).status().unwrap();assert!(status.success());
        let status=std::process::Command::new("ar").args(["rcs",&format!("{out}/libsunnydrag.a"),&format!("{out}/drag_monitor.o")]).status().unwrap();assert!(status.success());
        println!("cargo:rustc-link-search=native={out}");println!("cargo:rustc-link-lib=static=sunnydrag");println!("cargo:rustc-link-lib=framework=AppKit");println!("cargo:rustc-link-lib=framework=CoreGraphics");println!("cargo:rerun-if-changed=src/drag_monitor.m");
    }
    tauri_build::build();
}
