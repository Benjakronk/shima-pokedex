import requests
import json
from typing import Dict, List, Any
from datetime import datetime

class PokemonDataProcessor:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.headers = [
            "Image1", "NO1", "Species", "Image2", "NO2", "Classification", 
            "Description", "P_Type", "S_Type", "Size", "Rarity", "P_Habitat", 
            "Behavior", "Activity", "Evolution_R", "P_Ability", "S_Ability", 
            "H_Ability", "CDC", "Level", "AC", "HD", "HP", "VD", "VP", "Speed", 
            "Stat_Sum", "STR", "DEX", "CON", "INT", "WIS", "CHA", 
            "Saving_Throws", "Proficiency", 
            "Starting_Moves", "Second_Level_Moves", "Sixth_Level_Moves", 
            "Tenth_Level_Moves", "Fourteenth_Level_Moves", "Eighteenth_Level_Moves",
            "Special_Move1", "Special_Move2", "Special_Move3", "Special_Move4",
            "Second_Level1", "Second_Level2", "Second_Level3", "Second_Level4",
            "Sixth_Level1", "Sixth_Level2", "Sixth_Level3", "Sixth_Level4",
            "Tenth_Level1", "Tenth_Level2", "Tenth_Level3",
            "Fourteenth_Level1", "Fourteenth_Level2", "Fourteenth_Level3",
            "Eighteenth_Level1", "Eighteenth_Level2", "Eighteenth_Level3",
            "P_Ability_Description", "S_Ability_Description", "H_Ability_Description",
            "Walking", "Climbing", "Flying", "Hovering", "Swimming", "Burrowing",
            "Sight", "Hearing", "Smell", "Tremorsense", "Echolocation", 
            "Telepathy", "Blindsight", "Darkvision", "Truesight"
        ]
        
    def fetch_data(self) -> List[Any]:
        """Fetch Pokemon data from the endpoint"""
        try:
            response = requests.get(f"{self.base_url}?action=pokemon")
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching Pokemon data: {str(e)}")
            return []

    def process_pokemon_data(self, data: List[Any]) -> List[Dict]:
        """Process Pokemon data into a structured format"""
        pokemon_list = []
        
        for row in data:
            if not any(row):  # Skip empty rows
                continue
            
            pokemon_dict = {}
            
            # Process main data
            for i, header in enumerate(self.headers):
                if i < len(row):
                    # Convert empty strings to None
                    value = row[i] if row[i] != "" else None
                    
                    # Convert numeric strings to appropriate types
                    if header in ["NO1", "NO2", "Level", "AC", "HP", "VP", "Speed", 
                                "Stat_Sum", "STR", "DEX", "CON", "INT", "WIS", "CHA"]:
                        try:
                            value = int(value) if value is not None else None
                        except (ValueError, TypeError):
                            value = None
                    
                    pokemon_dict[header] = value
            
            # Only add Pokemon with a valid Species name
            if pokemon_dict.get("Species"):
                # Create structured move lists
                pokemon_dict["moves"] = {
                    "starting": self.split_moves(pokemon_dict.get("Starting_Moves")),
                    "level_2": self.split_moves(pokemon_dict.get("Second_Level_Moves")),
                    "level_6": self.split_moves(pokemon_dict.get("Sixth_Level_Moves")),
                    "level_10": self.split_moves(pokemon_dict.get("Tenth_Level_Moves")),
                    "level_14": self.split_moves(pokemon_dict.get("Fourteenth_Level_Moves")),
                    "level_18": self.split_moves(pokemon_dict.get("Eighteenth_Level_Moves")),
                }
                
                # Create structured senses dictionary
                pokemon_dict["senses"] = {
                    sense: pokemon_dict.get(sense)
                    for sense in ["Sight", "Hearing", "Smell", "Tremorsense", 
                                "Echolocation", "Telepathy", "Blindsight", 
                                "Darkvision", "Truesight"]
                }
                
                # Create structured movement dictionary
                pokemon_dict["movement"] = {
                    move_type: pokemon_dict.get(move_type)
                    for move_type in ["Walking", "Climbing", "Flying", "Hovering", 
                                    "Swimming", "Burrowing"]
                }
                
                # Create structured abilities dictionary
                pokemon_dict["abilities"] = {
                    "primary": {
                        "name": pokemon_dict.get("P_Ability"),
                        "description": pokemon_dict.get("P_Ability_Description")
                    },
                    "secondary": {
                        "name": pokemon_dict.get("S_Ability"),
                        "description": pokemon_dict.get("S_Ability_Description")
                    },
                    "hidden": {
                        "name": pokemon_dict.get("H_Ability"),
                        "description": pokemon_dict.get("H_Ability_Description")
                    }
                }
                
                # Clean up by removing redundant fields
                for key in list(pokemon_dict.keys()):
                    if key in ["Starting_Moves", "Second_Level_Moves", "Sixth_Level_Moves",
                             "Tenth_Level_Moves", "Fourteenth_Level_Moves", "Eighteenth_Level_Moves",
                             "P_Ability", "S_Ability", "H_Ability",
                             "P_Ability_Description", "S_Ability_Description", "H_Ability_Description"] + \
                            list(pokemon_dict["senses"].keys()) + \
                            list(pokemon_dict["movement"].keys()):
                        del pokemon_dict[key]
                
                pokemon_list.append(pokemon_dict)
                
        return pokemon_list
    
    def split_moves(self, moves_str: str) -> List[str]:
        """Split move string into list of moves"""
        if not moves_str:
            return []
        return [move.strip() for move in moves_str.split(',') if move.strip()]

    def save_to_json(self, data: Dict, filename: str):
        """Save processed data to a JSON file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{filename}_{timestamp}.json"
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Data successfully saved to {filename}")
        except Exception as e:
            print(f"Error saving data to JSON: {str(e)}")

    def process_and_save(self):
        """Process and save Pokemon data"""
        data = {
            'pokemon': self.process_pokemon_data(self.fetch_data()),
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'data_version': '1.0'
            }
        }
        
        self.save_to_json(data, 'pokemon_data')

def main():
    # Replace with your actual Apps Script web app URL
    base_url = 'https://script.google.com/macros/s/AKfycbwIT3OS2bdCv2kkDPh6IjRRirv17iPnuttlPcY47LCHBbpNPuHF_IjVq0mCt7TkkWoW/exec'
    
    processor = PokemonDataProcessor(base_url)
    processor.process_and_save()

if __name__ == "__main__":
    main()