import tkinter as tk
from tkinter import ttk
import json
import requests

def load_registered_pokemon():
    try:
        with open('registered_pokemon.json', 'r') as f:
            data = json.load(f)
            registered = set(data.get('registered', []))
            print(f"Loaded registered Pokémon: {registered}")  # Debugging
            return registered
    except FileNotFoundError:
        print("registered_pokemon.json not found. Starting with empty set.")  # Debugging
        return set()

def save_registered_pokemon(pokemon_list):
    with open('registered_pokemon.json', 'w') as f:
        json.dump({"registered": list(pokemon_list)}, f, indent=4)
    print(f"Saved registered Pokémon: {pokemon_list}")  # Debugging

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

        self.create_widgets()

    def create_widgets(self):
        frame = ttk.Frame(self.master)
        frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(frame)
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        for pokemon in self.pokemon_list:
            var = tk.BooleanVar(value=pokemon in self.registered_pokemon)
            cb = ttk.Checkbutton(scrollable_frame, text=pokemon, variable=var)
            cb.pack(anchor='w')
            self.checkboxes.append((pokemon, var))

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        save_button = ttk.Button(self.master, text="Save", command=self.save_selection)
        save_button.pack(pady=10)

    def save_selection(self):
        selected_pokemon = {pokemon for pokemon, var in self.checkboxes if var.get()}
        save_registered_pokemon(selected_pokemon)
        print(f"Selected Pokémon: {selected_pokemon}")  # Debugging
        self.master.quit()

def main():
    registered_pokemon = load_registered_pokemon()
    pokemon_list = fetch_pokemon_from_web_app()
    
    if not pokemon_list:
        print("No Pokémon data fetched. Exiting.")
        return

    root = tk.Tk()
    root.title("Pokémon Selector")
    root.geometry("300x400")
    app = PokemonSelector(root, pokemon_list, registered_pokemon)
    root.mainloop()

if __name__ == "__main__":
    main()