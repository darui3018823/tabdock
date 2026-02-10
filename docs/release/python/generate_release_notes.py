import re

def parse_release_notes(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Regex to parse the git log line: "hash - message (date)"
    # But wait, my file has line numbers! "1: 0bc8210 - ..."
    # I need to strip the "1: " prefix.
    
    # We process from bottom (oldest) to top (newest)
    # But wait, the file is Newest (line 1) to Oldest (line 454).
    # So iterating reversed(lines) gives chronological order.
    
    versions = []
    current_version = {
        "version": "v3.0.0 (Alpha)", # Start point assumption based on log
        "date": "",
        "sections": {
            "Features": [],
            "Bug Fixes": [],
            "Documentation": [],
            "Improvements": [],
            "Maintenance": [],
            "Other": []
        }
    }
    
    # regex for version bumps
    # "v5.0.0", "version to 5.20.0", "Bump version ...", "v5.19.7"
    version_pattern = re.compile(r'(?:v\d+\.\d+\.\d+|version to \d+\.\d+\.\d+|Bump.*?version.*?to \d+\.\d+\.\d+)', re.IGNORECASE)
    
    entries = []
    
    # First, parse all lines into objects
    for line in lines:
        # File format: "hash - message (date)"
        # Note: view_file added line numbers, but the actual file doesn't have them.
        match = re.match(r'([a-f0-9]+) - (.*) \((.*)\)', line.strip())
        if match:
            entries.append({
                "hash": match.group(1),
                "message": match.group(2),
                "date": match.group(3)
            })
    
    # Process chronologically (Oldest first)
    entries.reverse()
    
    # Initialize with the first "Start" date
    if entries:
        current_version["date"] = entries[0]["date"]

    for entry in entries:
        msg = entry["message"]
        
        # Check for version bump
        # If this commit IS a version bump, it concludes the current version (usually)
        # Or does it start a new one?
        # Usually "Bump to 5.0" means the code *now* is 5.0. So recent commits belong to 5.0.
        # So we add this commit to the CURRENT version, close it, and start a NEW unreleased one?
        # No, if I am accumulating for "v4.0", and I hit "v4.0 release", that closes v4.0.
        
        is_version_bump = False
        new_version_name = ""
        
        # Explicit version detection
        v_match = version_pattern.search(msg)
        if v_match:
            is_version_bump = True
            # Extract version number strictly
            v_num = re.search(r'\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)?', msg)
            if v_num:
                new_version_name = "v" + v_num.group(0).lstrip('v')

        # Categorize
        cat = "Other"
        clean_msg = msg
        
        if msg.lower().startswith("merge"):
            continue # Skip merges for cleaner notes? Or keep them? User asked for git history.
                     # Let's skip purely boring merges, but some are PR merges with info.
                     # If it's "Merge pull request #...", maybe meaningful?
                     # Let's Skip "Merge branch 'main'..."
            if "Merge branch 'main'" in msg:
                continue
        
        lower_msg = msg.lower()
        if lower_msg.startswith("feat"):
            cat = "Features"
            clean_msg = re.sub(r'^feat(?:\(.*\))?:\s*', '', msg, flags=re.IGNORECASE)
        elif lower_msg.startswith("fix"):
            cat = "Bug Fixes"
            clean_msg = re.sub(r'^fix(?:\(.*\))?:\s*', '', msg, flags=re.IGNORECASE)
        elif lower_msg.startswith("docs"):
            cat = "Documentation"
            clean_msg = re.sub(r'^docs(?:\(.*\))?:\s*', '', msg, flags=re.IGNORECASE)
        elif lower_msg.startswith("style") or lower_msg.startswith("refactor") or lower_msg.startswith("perf") or lower_msg.startswith("test"):
            cat = "Improvements"
            clean_msg = re.sub(r'^(?:style|refactor|perf|test)(?:\(.*\))?:\s*', '', msg, flags=re.IGNORECASE)
        elif lower_msg.startswith("build") or lower_msg.startswith("ci") or lower_msg.startswith("chore"):
            cat = "Maintenance"
            clean_msg = re.sub(r'^(?:build|ci|chore)(?:\(.*\))?:\s*', '', msg, flags=re.IGNORECASE)
        else:
            cat = "Other"

        # Add to current version
        # If it is a version bump commit, we use it to name the version, but the text might be boring.
        current_version["sections"][cat].append(f"- {clean_msg} ({entry['hash']})")
        
        if is_version_bump:
            if new_version_name:
                current_version["version"] = new_version_name
            current_version["date"] = entry["date"] # Update date to release date
            versions.append(current_version)
            
            # Start new version
            current_version = {
                "version": "Unreleased / Next",
                "date": entry["date"],
                "sections": {
                    "Features": [],
                    "Bug Fixes": [],
                    "Documentation": [],
                    "Improvements": [],
                    "Maintenance": [],
                    "Other": []
                }
            }
            
    # Add remaining
    if any(current_version["sections"].values()):
        current_version["version"] = "Latest (Post-release)"
        versions.append(current_version)

    # Write Markdown
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# Release Notes (Generated from Git History)\n\n")
        f.write(f"Range: `d30d768` ... `0bc8210`\n\n")
        
        # Reverse versions to show Newest first
        for v in reversed(versions):
            # Check if empty (sometimes 'Latest' is empty if log ended exactly on a bump)
            has_content = any(v["sections"].values())
            if not has_content:
                continue

            f.write(f"## {v['version']} ({v['date']})\n\n")
            
            for section in ["Features", "Bug Fixes", "Improvements", "Documentation", "Maintenance", "Other"]:
                items = v["sections"][section]
                if items:
                    f.write(f"### {section}\n")
                    for item in items:
                        f.write(f"{item}\n")
                    f.write("\n")

if __name__ == "__main__":
    parse_release_notes("release_notes_raw.txt", "release_notes.md")
