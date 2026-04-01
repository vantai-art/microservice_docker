from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import httpx, os, logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Product Service", version="1.0.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

LOG_SERVICE_URL = os.getenv("LOG_SERVICE_URL", "http://log-service:8006")
MONGO_URL       = os.getenv("MONGO_URL", "mongodb://mongo:mongo@mongodb:27017")

# ─── Try connect MongoDB, fallback to in-memory ──────────
db_collection = None
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    db = client["productdb"]
    db_collection = db["products"]
    logger.info("Connected to MongoDB")
except Exception as e:
    logger.warning(f"MongoDB unavailable, using in-memory store: {e}")

# ─── In-memory fallback ──────────────────────────────────
_mem_products: List[dict] = [
    {"id": "1", "name": "Laptop Pro",    "description": "High-end laptop",  "price": 999.99,  "category": "Electronics", "stock": 50,  "active": True, "created_at": datetime.now().isoformat()},
    {"id": "2", "name": "Smartphone X",  "description": "Latest flagship",  "price": 499.99,  "category": "Electronics", "stock": 100, "active": True, "created_at": datetime.now().isoformat()},
    {"id": "3", "name": "Coffee Maker",  "description": "Premium brewer",   "price": 89.99,   "category": "Kitchen",     "stock": 30,  "active": True, "created_at": datetime.now().isoformat()},
    {"id": "4", "name": "Running Shoes", "description": "Sport shoes",      "price": 129.99,  "category": "Sports",      "stock": 75,  "active": True, "created_at": datetime.now().isoformat()},
]
_next_id = 5

# ─── Models ─────────────────────────────────────────────
class ProductCreate(BaseModel):
    name:        str          = Field(..., min_length=1, max_length=255)
    description: str          = Field(..., min_length=1)
    price:       float        = Field(..., gt=0)
    category:    str          = Field(..., min_length=1)
    stock:       int          = Field(..., ge=0)
    active:      bool         = True

class ProductUpdate(BaseModel):
    name:        Optional[str]   = None
    description: Optional[str]   = None
    price:       Optional[float] = None
    category:    Optional[str]   = None
    stock:       Optional[int]   = None
    active:      Optional[bool]  = None

# ─── Log Helper ──────────────────────────────────────────
async def send_log(action: str, detail: str, status: int = 200):
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            await client.post(f"{LOG_SERVICE_URL}/api/logs", json={
                "service":   "product-service",
                "action":    action,
                "detail":    detail,
                "status":    status,
                "level":     "ERROR" if status >= 400 else "INFO",
                "timestamp": datetime.now().isoformat(),
            })
    except Exception:
        pass

# ─── DB Helpers ──────────────────────────────────────────
async def get_all_products(category=None, search=None, skip=0, limit=20, active_only=True):
    global _mem_products
    if db_collection:
        query = {}
        if active_only: query["active"] = True
        if category:    query["category"] = category
        if search:      query["name"] = {"$regex": search, "$options": "i"}
        cursor = db_collection.find(query, {"_id": 0}).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)
    result = _mem_products[:]
    if active_only: result = [p for p in result if p.get("active", True)]
    if category:    result = [p for p in result if p["category"] == category]
    if search:      result = [p for p in result if search.lower() in p["name"].lower()]
    return result[skip:skip + limit]

async def get_product_by_id(pid: str):
    if db_collection:
        return await db_collection.find_one({"id": pid}, {"_id": 0})
    return next((p for p in _mem_products if p["id"] == pid), None)

async def create_product_db(data: dict):
    global _next_id, _mem_products
    if db_collection:
        await db_collection.insert_one(data)
        return data
    data["id"] = str(_next_id)
    _next_id += 1
    _mem_products.append(data)
    return data

async def update_product_db(pid: str, updates: dict):
    global _mem_products
    if db_collection:
        await db_collection.update_one({"id": pid}, {"$set": updates})
        return await get_product_by_id(pid)
    for i, p in enumerate(_mem_products):
        if p["id"] == pid:
            _mem_products[i] = {**p, **updates, "updated_at": datetime.now().isoformat()}
            return _mem_products[i]
    return None

async def delete_product_db(pid: str):
    global _mem_products
    if db_collection:
        result = await db_collection.delete_one({"id": pid})
        return result.deleted_count > 0
    before = len(_mem_products)
    _mem_products = [p for p in _mem_products if p["id"] != pid]
    return len(_mem_products) < before

# ─── Routes ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "product-service", "db": "mongodb" if db_collection else "memory"}

@app.get("/api/products")
async def list_products(
    category: Optional[str] = None,
    search:   Optional[str] = None,
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, ge=1, le=100),
    show_inactive: bool = False,
):
    skip = (page - 1) * limit
    products = await get_all_products(category, search, skip, limit, active_only=not show_inactive)
    await send_log("LIST_PRODUCTS", f"category={category}, search={search}, page={page}")
    return {"data": products, "page": page, "limit": limit}

@app.get("/api/products/categories")
async def list_categories():
    if db_collection:
        cats = await db_collection.distinct("category")
    else:
        cats = list({p["category"] for p in _mem_products})
    return {"categories": sorted(cats)}

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    product = await get_product_by_id(product_id)
    if not product:
        await send_log("GET_PRODUCT", f"id={product_id} not found", 404)
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    await send_log("GET_PRODUCT", f"id={product_id}, name={product['name']}")
    return product

@app.post("/api/products", status_code=201)
async def create_product(product: ProductCreate):
    data = {
        **product.model_dump(),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    new = await create_product_db(data)
    await send_log("CREATE_PRODUCT", f"name={product.name}, price={product.price}")
    return new

@app.put("/api/products/{product_id}")
async def update_product(product_id: str, updates: ProductUpdate):
    product = await get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    updated = await update_product_db(product_id, update_data)
    await send_log("UPDATE_PRODUCT", f"id={product_id}, fields={list(update_data.keys())}")
    return updated

@app.patch("/api/products/{product_id}/stock")
async def update_stock(product_id: str, quantity: int):
    product = await get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    new_stock = product["stock"] + quantity
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Tồn kho không đủ")
    updated = await update_product_db(product_id, {"stock": new_stock})
    await send_log("UPDATE_STOCK", f"id={product_id}, delta={quantity}, new_stock={new_stock}")
    return updated

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str):
    deleted = await delete_product_db(product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")
    await send_log("DELETE_PRODUCT", f"id={product_id}")
    return {"message": "Đã xóa sản phẩm", "id": product_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
