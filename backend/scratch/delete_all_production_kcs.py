import urllib.request
import urllib.parse
import json
import sys

BACKEND_URL = "https://ultimate-adaptive-backend.onrender.com"

def get_graph():
    url = f"{BACKEND_URL}/graph/"
    print(f"Fetching graph from {url}...")
    try:
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
            else:
                print(f"Failed to fetch graph. Status: {response.status}")
                return None
    except Exception as e:
        print(f"Error fetching graph: {e}")
        return None

def delete_edge(prereq_id, kc_id):
    url = f"{BACKEND_URL}/graph/prerequisite?kc_id={kc_id}&prereq_id={prereq_id}"
    print(f"Deleting Edge: {prereq_id} → {kc_id}...")
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"  → Result: {data}")
            return True
    except Exception as e:
        print(f"  ✗ Failed to delete edge: {e}")
        return False

def delete_kc(kc_id, code):
    url = f"{BACKEND_URL}/graph/kc/{kc_id}"
    print(f"Deleting KC: {code} ({kc_id})...")
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"  → Result: {data}")
            return True
    except Exception as e:
        print(f"  ✗ Failed to delete {code}: {e}")
        return False

def main():
    graph = get_graph()
    if not graph:
        print("Could not fetch graph data. Exiting.")
        sys.exit(1)
        
    edges = graph.get("edges", [])
    nodes = graph.get("nodes", [])
    
    print(f"Found {len(edges)} edges and {len(nodes)} nodes on production.")
    
    # 1. Delete all edges first
    if edges:
        print("\n--- Phase 1: Deleting Edges ---")
        edge_success_count = 0
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            if source and target:
                if delete_edge(source, target):
                    edge_success_count += 1
        print(f"Deleted {edge_success_count}/{len(edges)} edges.")
        
    # 2. Delete all nodes second
    if nodes:
        print("\n--- Phase 2: Deleting KCs ---")
        node_success_count = 0
        for node in nodes:
            kc_id = node.get("id")
            code = node.get("code")
            if kc_id and code:
                if delete_kc(kc_id, code):
                    node_success_count += 1
        print(f"Deleted {node_success_count}/{len(nodes)} nodes.")
        
    print("\nProduction database cleanup complete!")

if __name__ == "__main__":
    main()
