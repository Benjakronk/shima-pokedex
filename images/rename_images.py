import os
import re
import sys

def sanitize_filename(name):
    # Convert to lowercase
    name = name.lower()
    # Replace spaces with hyphens
    name = name.replace(' ', '-')
    # Remove any character that isn't a-z, 0-9, or hyphen
    name = re.sub(r'[^a-z0-9-]', '', name)
    # Replace multiple hyphens with a single hyphen
    name = re.sub(r'-+', '-', name)
    return name

def rename_images():
    current_directory = os.getcwd()
    print(f"Current working directory: {current_directory}")
    
    image_files = [f for f in os.listdir(current_directory) if f.lower().endswith(('jfif','.png', '.jpg', '.jpeg', '.gif'))]
    
    if not image_files:
        print("No image files found in the current directory.")
        return

    print(f"Found {len(image_files)} image files.")

    for filename in image_files:
        print(f"Processing: {filename}")
        name, ext = os.path.splitext(filename)
        new_name = sanitize_filename(name) + ext.lower()
        if new_name != filename:
            try:
                os.rename(filename, new_name)
                print(f"Renamed: {filename} -> {new_name}")
            except Exception as e:
                print(f"Error renaming {filename}: {str(e)}")
        else:
            print(f"Skipped: {filename} (already correctly named)")

    print("Image renaming process completed.")

if __name__ == "__main__":
    print("Python version:", sys.version)
    print("Starting image renaming process...")
    rename_images()