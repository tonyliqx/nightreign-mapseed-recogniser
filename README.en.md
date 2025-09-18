# Nightreign Map Recogniser

Nightreign Map Recogniser is an application designed for identifying and interactively exploring game maps. It is specifically built to recognize Points of Interest (POI) on maps and provides a user-friendly interface for analyzing and manipulating map data.

You can access this tool from one of these sites:
- **Beta version** [here](https://tonyliqx.github.io/nightreign-mapseed-recogniser/)
- **Stable version** [here](https://dsm.lixiangzj.xyz:7443/)

## Acknowledgements

- [thefifthmatt](https://github.com/thefifthmatt): Provided map data
- [thanosapollo](https://github.com/thanosapollo): Provided the base recognizer code
- [Fuwish](https://space.bilibili.com/46397427): Provided the Chinese localized map seeds

## Features

- **Map Recognition**: Identify Points of Interest (POI) on maps using predefined patterns.
- **Interactive Interface**: Offers an intuitive user interface that supports clicking, selecting, and manipulating POIs on the map.
- **Multi-Map Support**: Supports multiple maps and selections of Nightlords, allowing users to switch between different maps for analysis.
- **POI Classification**: Capable of categorizing and marking Points of Interest on the map.
- **Seed Data Support**: Supports loading and analyzing seed data to help users identify specific map features.

## Usage Instructions

1. **Start the Server**:
   - Ensure you have Node.js installed.
   - Run `node server.js` in the project directory to start the local server.
   - Open your browser and navigate to `http://localhost:3000`.

2. **Select Map and Nightlord**:
   - Choose a Nightlord and the corresponding map from the interface.
   - Click the "Continue" button to enter the map interaction interface.

3. **Interactive Operations**:
   - Click on Points of Interest on the map to view detailed information.
   - Use the right-click menu to classify or mark POIs.
   - Use the tool buttons for reset, help, and classification operations.

4. **View Results**:
   - View identified Points of Interest and related data in the results section.
   - Use the seed counter to track the number of identified seeds.

## Technical Details

- **Frontend**: Built using HTML, CSS, and JavaScript to create an interactive user interface.
- **Backend**: Node.js is used to provide local server support.
- **Image Processing**: Canvas elements are used for drawing and interacting with maps and POIs.
- **Data Management**: JSON files are used to store map data, POI data, and seed data.

## Contribution Guidelines

Code contributions and project improvements are welcome. Please follow the steps below:

1. Fork this repository.
2. Create a new branch (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -m 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Create a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). For details, please refer to the LICENSE file.