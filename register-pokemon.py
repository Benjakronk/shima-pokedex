import tkinter as tk
from tkinter import ttk
import json
import requests
import os
import platform

# Get the directory of the script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(SCRIPT_DIR, 'registered_pokemon.json')

def load_registered_pokemon():
    try:
        with open(JSON_FILE, 'r') as f:
            data = json.load(f)
            registered = set(data.get('registered', []))
            print(f"Loaded registered Pokémon from {JSON_FILE}: {registered}")  # Debugging
            return registered
    except FileNotFoundError:
        print(f"{JSON_FILE} not found. Starting with empty set.")  # Debugging
        return set()

def save_registered_pokemon(pokemon_list):
    with open(JSON_FILE, 'w') as f:
        json.dump({"registered": list(pokemon_list)}, f, indent=4)
    print(f"Saved registered Pokémon to {JSON_FILE}: {pokemon_list}")  # Debugging

def fetch_pokemon_from_web_app():
    url = "https://script.google.com/macros/s/AKfycbz5jkSQ1HuCpCrbg_mePsfLDaoesjCvrX_fCAhJvTC5V3IddYmtjVJnh4_2YaX37Dkj/exec?action=pokemon"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        pokemon_list = [row[2] for row in data if len(row) > 2 and row[2]]
        
        print(f"Fetched Pokémon (first 5): {pokemon_list[:5]}...")
        return pokemon_list
    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return []
    except (IndexError, KeyError) as e:
        print(f"Error processing data: {e}")
        print(f"Received data structure: {data[:5]}...")
        return []

class PokemonSelector:
    def __init__(self, master, pokemon_list, registered_pokemon):
        self.master = master
        self.pokemon_list = pokemon_list
        self.registered_pokemon = registered_pokemon
        self.checkboxes = []
        self.filter_var = tk.StringVar()
        self.filter_var.trace("w", self.filter_pokemon)

        self.create_widgets()

    def create_widgets(self):
        frame = ttk.Frame(self.master)
        frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        # Add search box
        self.search_entry = ttk.Entry(frame, textvariable=self.filter_var)
        self.search_entry.pack(pady=5, fill=tk.X)

        self.canvas = tk.Canvas(frame)
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=self.canvas.yview)
        self.scrollable_frame = ttk.Frame(self.canvas)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )

        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)

        for pokemon in self.pokemon_list:
            var = tk.BooleanVar(value=pokemon in self.registered_pokemon)
            cb = ttk.Checkbutton(self.scrollable_frame, text=pokemon, variable=var)
            cb.pack(anchor='w')
            self.checkboxes.append((pokemon, var, cb))

        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Bind scrolling events
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)
        self.canvas.bind_all("<Button-4>", self._on_mousewheel)
        self.canvas.bind_all("<Button-5>", self._on_mousewheel)

        save_button = ttk.Button(self.master, text="Save", command=self.save_selection)
        save_button.pack(pady=10)

    def _on_mousewheel(self, event):
        if platform.system() == "Windows":
            self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        elif platform.system() == "Darwin":  # macOS
            self.canvas.yview_scroll(int(-1 * event.delta), "units")
        else:  # Linux and other Unix
            if event.num == 4:
                self.canvas.yview_scroll(-1, "units")
            elif event.num == 5:
                self.canvas.yview_scroll(1, "units")

    def filter_pokemon(self, *args):
        search_term = self.filter_var.get().lower()
        for pokemon, var, cb in self.checkboxes:
            if search_term in pokemon.lower():
                cb.pack(anchor='w')
            else:
                cb.pack_forget()

    def save_selection(self):
        selected_pokemon = {pokemon for pokemon, var, _ in self.checkboxes if var.get()}
        save_registered_pokemon(selected_pokemon)
        print(f"Selected Pokémon: {selected_pokemon}")  # Debugging
        self.master.quit()

def main():
    print(f"Script directory: {SCRIPT_DIR}")  # Debugging
    print(f"JSON file path: {JSON_FILE}")  # Debugging
    
    registered_pokemon = load_registered_pokemon()
    pokemon_list = fetch_pokemon_from_web_app()
    
    if not pokemon_list:
        print("No Pokémon data fetched. Exiting.")
        return

    root = tk.Tk()
    root.title("Pokémon Selector")
    root.geometry("500x500")
    app = PokemonSelector(root, pokemon_list, registered_pokemon)
    root.mainloop()

if __name__ == "__main__":
    main()