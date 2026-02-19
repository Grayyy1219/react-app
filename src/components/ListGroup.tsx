import { useState, type MouseEvent } from "react";
function ListGroup() {
  let names = ["Franz", "Domo", "Kenji"];
  // let selected_name = 0;
  const [Selected_name, setSelected_name] = useState(-1);
  //   names = [];
  let handleClick = (event: MouseEvent) => console.log({ event });

  //   if (names.length == 0) return <h2>No Names found</h2>;
  return (
    <>
      <h2>List Label</h2>
      {names.length == 0 ? <p>No Item Found</p> : null}
      <ul className="list-group">
        {names.map((name, index) => (
          <li
            className={
              Selected_name === index
                ? "list-group-item active"
                : "list-group-item"
            }
            key={name}
            onClick={() => {
              setSelected_name(index);
            }}
          >
            {name}
          </li>
        ))}
      </ul>
    </>
  );
}
export default ListGroup;
